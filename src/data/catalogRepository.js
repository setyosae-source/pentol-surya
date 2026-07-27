import { requireSupabase } from '../core/supabaseClient.js';
import { store } from '../core/store.js';

export const catalogRepository = {
  async loadOutlets() {
    const cached = store.getState();
    if (cached.outletsLoaded && cached.outlets.length) return cached.outlets;

    const client = requireSupabase();
    const { data, error } = await client
      .from('outlets')
      .select('*')
      .eq('active', true)
      .order('name');
    if (error) throw error;
    store.setState({ outlets: data || [], outletsLoaded: true });
    return data || [];
  },

  async loadProducts(outletId = null) {
    const cached = store.getState();
    if (cached.productsLoadedFor === (outletId || 'all') && cached.products.length) {
      return cached.products;
    }

    const client = requireSupabase();
    const profile = store.getState().profile;
    const canViewCost = ['owner', 'manager'].includes(profile?.role);
    const { data: products, error } = await client
      .from('products')
      .select('*, product_categories(name)')
      .eq('active', true)
      .order('name');
    if (error) throw error;

    if (!outletId) {
      const withCosts = await attachCosts(products || [], canViewCost);
      store.setState({ products: withCosts, productsLoadedFor: 'all' });
      return withCosts;
    }

    const { data: prices, error: priceError } = await client
      .from('outlet_product_prices')
      .select('*')
      .eq('outlet_id', outletId)
      .eq('active', true)
      .order('valid_from', { ascending: false });
    if (priceError) throw priceError;

    const latestPriceByProduct = new Map();
    (prices || []).forEach((price) => {
      if (!latestPriceByProduct.has(price.product_id)) {
        latestPriceByProduct.set(price.product_id, price.sale_price);
      }
    });

    const withCosts = await attachCosts(products || [], canViewCost);
    const resolved = withCosts.map((product) => ({
      ...product,
      resolved_price: latestPriceByProduct.get(product.id) ?? product.general_sale_price,
    }));
    store.setState({ products: resolved, productsLoadedFor: outletId });
    return resolved;
  },

  async saveOutlet(payload) {
    const client = requireSupabase();
    const record = cleanBlank(payload);
    const request = record.id
      ? client.from('outlets').update(record).eq('id', record.id).select().single()
      : client.from('outlets').insert(record).select().single();
    const { data, error } = await request;
    if (error) throw error;
    store.setState({ outletsLoaded: false });
    return data;
  },

  async saveProduct(payload) {
    const client = requireSupabase();
    const { hpp, ...productPayload } = payload;
    const record = cleanBlank(productPayload);
    const request = record.id
      ? client.from('products').update(record).eq('id', record.id).select().single()
      : client.from('products').insert(record).select().single();
    const { data, error } = await request;
    if (error) throw error;

    if (hpp !== undefined && hpp !== null) {
      const { error: costError } = await client.from('product_costs').insert({
        tenant_id: data.tenant_id,
        product_id: data.id,
        hpp,
      });
      if (costError) throw costError;
    }

    store.setState({ productsLoadedFor: null });
    return data;
  },

  async saveOutletPrice({ tenant_id, outlet_id, product_id, sale_price }) {
    const client = requireSupabase();
    const { data, error } = await client
      .from('outlet_product_prices')
      .insert({ tenant_id, outlet_id, product_id, sale_price })
      .select()
      .single();
    if (error) throw error;
    store.setState({ productsLoadedFor: null });
    return data;
  },

  async applyOutletPrice({ tenant_id, outlet_id, product_id, sale_price }) {
    const client = requireSupabase();
    const outlets = outlet_id === 'all' ? await this.loadOutlets() : [{ id: outlet_id }];
    const rows = outlets.map((outlet) => ({
      tenant_id,
      outlet_id: outlet.id,
      product_id,
      sale_price,
    }));

    const { data, error } = await client
      .from('outlet_product_prices')
      .insert(rows)
      .select();
    if (error) throw error;
    store.setState({ productsLoadedFor: null });
    return data || [];
  },
};

async function attachCosts(products, canViewCost) {
  if (!canViewCost || !products.length) {
    return products.map((product) => ({ ...product, can_view_cost: false }));
  }

  const client = requireSupabase();
  const { data, error } = await client
    .from('product_costs')
    .select('product_id, hpp, valid_from')
    .in('product_id', products.map((product) => product.id))
    .order('valid_from', { ascending: false });
  if (error) throw error;

  const latest = new Map();
  (data || []).forEach((row) => {
    if (!latest.has(row.product_id)) latest.set(row.product_id, row.hpp);
  });

  return products.map((product) => ({
    ...product,
    hpp: latest.get(product.id) ?? 0,
    can_view_cost: true,
  }));
}

function cleanBlank(record) {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== '' && value !== undefined),
  );
}
