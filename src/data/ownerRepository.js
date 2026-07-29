import { requireSupabase } from '../core/supabaseClient.js';
import { todayRange } from '../core/utils.js';

export const ownerRepository = {
  async getKpis(range = todayRange()) {
    const client = requireSupabase();
    const { data, error } = await client.rpc('dashboard_kpis', {
      range_start: range.start,
      range_end: range.end,
    });
    if (error) throw error;
    return data || {};
  },

  async getActiveShifts() {
    const client = requireSupabase();
    const { data, error } = await client
      .from('shifts')
      .select('*, employees(employee_code, phone, user_profiles(full_name)), outlets(name, sale_lat, sale_lng, geofence_radius_m)')
      .in('status', ['active', 'final_reported'])
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getLatestLocations() {
    const client = requireSupabase();
    const { data, error } = await client
      .from('location_pings')
      .select('*, employees(employee_code, user_profiles(full_name)), outlets(name)')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return uniqueBy(data || [], (row) => row.shift_id);
  },

  async getProductPerformance(range = todayRange()) {
    const client = requireSupabase();
    const { data, error } = await client
      .from('sale_items')
      .select('qty, subtotal, products(name), sales!inner(occurred_at)')
      .gte('sales.occurred_at', range.start)
      .lt('sales.occurred_at', range.end);
    if (error) throw error;

    const byProduct = new Map();
    (data || []).forEach((row) => {
      const name = row.products?.name || 'Produk';
      const current = byProduct.get(name) || { name, qty: 0, amount: 0 };
      current.qty += Number(row.qty || 0);
      current.amount += Number(row.subtotal || 0);
      byProduct.set(name, current);
    });
    return [...byProduct.values()].sort((a, b) => b.amount - a.amount).slice(0, 8);
  },

  async getTopOutlets(range = todayRange()) {
    const client = requireSupabase();
    const { data, error } = await client
      .from('sales')
      .select('total_amount, outlets(name), occurred_at')
      .gte('occurred_at', range.start)
      .lt('occurred_at', range.end);
    if (error) throw error;

    const byOutlet = new Map();
    (data || []).forEach((row) => {
      const name = row.outlets?.name || 'Outlet';
      const current = byOutlet.get(name) || { name, amount: 0 };
      current.amount += Number(row.total_amount || 0);
      byOutlet.set(name, current);
    });
    return [...byOutlet.values()].sort((a, b) => b.amount - a.amount).slice(0, 8);
  },

  async getAuditLogs() {
    const client = requireSupabase();
    const { data, error } = await client
      .from('audit_logs')
      .select('id, table_name, action, record_id, reason, created_at, actor_id')
      .order('created_at', { ascending: false })
      .limit(25);
    if (error) throw error;
    return data || [];
  },

  async listGeneralExpenses() {
    const client = requireSupabase();
    const { data, error } = await client
      .from('general_expenses')
      .select('*')
      .order('occurred_at', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async addGeneralExpense(payload) {
    return this.saveGeneralExpense(payload);
  },

  async saveGeneralExpense(payload) {
    const client = requireSupabase();
    const record = cleanBlank(payload);
    const request = record.id
      ? client.from('general_expenses').update(record).eq('id', record.id).select().single()
      : client.from('general_expenses').insert(record).select().single();
    const { data, error } = await request;
    if (error) throw error;
    return data;
  },

  async deleteGeneralExpense(id) {
    const client = requireSupabase();
    const { error } = await client.from('general_expenses').delete().eq('id', id);
    if (error) throw error;
  },

  async listPayrollPeriods() {
    const client = requireSupabase();
    const { data, error } = await client
      .from('payroll_periods')
      .select('*')
      .order('starts_on', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async createPayrollPeriod(payload) {
    return this.savePayrollPeriod(payload);
  },

  async savePayrollPeriod(payload) {
    const client = requireSupabase();
    const record = cleanBlank(payload);
    const request = record.id
      ? client.from('payroll_periods').update(record).eq('id', record.id).select().single()
      : client.from('payroll_periods').insert(record).select().single();
    const { data, error } = await request;
    if (error) throw error;
    return data;
  },

  async deletePayrollPeriod(id) {
    const client = requireSupabase();
    const { error } = await client.from('payroll_periods').delete().eq('id', id);
    if (error) throw error;
  },
};

function uniqueBy(list, keyFn) {
  const map = new Map();
  list.forEach((item) => {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, item);
  });
  return [...map.values()];
}

function cleanBlank(record) {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== '' && value !== undefined),
  );
}
