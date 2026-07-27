import { requireSupabase } from '../core/supabaseClient.js';
import { queueMutation } from '../core/offlineQueue.js';

export const operationsRepository = {
  async addSale({ shift, paymentMethod, items, customerName, customerPhone, note }) {
    return queueOrExecute('addSale', { shift, paymentMethod, items, customerName, customerPhone, note }, async () => {
      const client = requireSupabase();
      const { data: sale, error } = await client
        .from('sales')
        .insert({
          tenant_id: shift.tenant_id,
          shift_id: shift.id,
          employee_id: shift.employee_id,
          outlet_id: shift.outlet_id,
          payment_method: paymentMethod,
          customer_name: customerName || null,
          customer_phone: customerPhone || null,
          note,
          client_ref: crypto.randomUUID(),
        })
        .select()
        .single();
      if (error) throw error;

      const rows = items.map((item) => ({
        tenant_id: shift.tenant_id,
        sale_id: sale.id,
        shift_id: shift.id,
        product_id: item.product_id,
        qty: item.qty,
        unit_price_snapshot: item.unit_price_snapshot,
        hpp_snapshot: item.hpp_snapshot,
      }));

      if (rows.length) {
        const { error: itemError } = await client.from('sale_items').insert(rows);
        if (itemError) throw itemError;
      }

      return sale;
    });
  },

  async addOutletExpense({ shift, category, amount, note }) {
    return queueOrExecute('addOutletExpense', { shift, category, amount, note }, async () => {
      const client = requireSupabase();
      const { data, error } = await client
        .from('outlet_expenses')
        .insert({
          tenant_id: shift.tenant_id,
          shift_id: shift.id,
          employee_id: shift.employee_id,
          outlet_id: shift.outlet_id,
          category,
          amount,
          note,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    });
  },

  async addSupply({ shift, sourceName, sourceRole, note, items }) {
    return queueOrExecute('addSupply', { shift, sourceName, sourceRole, note, items }, async () => {
      const client = requireSupabase();
      const { data: supply, error } = await client
        .from('supplies')
        .insert({
          tenant_id: shift.tenant_id,
          shift_id: shift.id,
          employee_id: shift.employee_id,
          outlet_id: shift.outlet_id,
          source_name: sourceName,
          source_role: sourceRole,
          note,
        })
        .select()
        .single();
      if (error) throw error;

      if (items.length) {
        const { error: itemError } = await client.from('supply_items').insert(items.map((item) => ({
          tenant_id: shift.tenant_id,
          supply_id: supply.id,
          shift_id: shift.id,
          product_id: item.product_id,
          qty: item.qty,
          unit_hpp_snapshot: item.unit_hpp_snapshot,
        })));
        if (itemError) throw itemError;
      }

      return supply;
    });
  },

  async addWaste({ shift, productId, qty, reason, unitHppSnapshot, photoPath = null }) {
    return queueOrExecute('addWaste', { shift, productId, qty, reason, unitHppSnapshot, photoPath }, async () => {
      const client = requireSupabase();
      const { error } = await client
        .from('waste_items')
        .insert({
          tenant_id: shift.tenant_id,
          shift_id: shift.id,
          employee_id: shift.employee_id,
          outlet_id: shift.outlet_id,
          product_id: productId,
          qty,
          reason,
          unit_hpp_snapshot: unitHppSnapshot,
          photo_path: photoPath,
        });
      if (error) throw error;
      return { ok: true };
    });
  },

  async addPeriodicReport({ shift, values, items }) {
    return queueOrExecute('addPeriodicReport', { shift, values, items }, async () => {
      const client = requireSupabase();
      const { data: report, error } = await client
        .from('periodic_reports')
        .insert({
          tenant_id: shift.tenant_id,
          shift_id: shift.id,
          employee_id: shift.employee_id,
          outlet_id: shift.outlet_id,
          cash_amount: values.cash_amount,
          qris_amount: values.qris_amount,
          transfer_amount: values.transfer_amount,
          note: values.note,
        })
        .select()
        .single();
      if (error) throw error;

      if (items.length) {
        const { error: itemError } = await client.from('periodic_report_items').insert(items.map((item) => ({
          tenant_id: shift.tenant_id,
          periodic_report_id: report.id,
          shift_id: shift.id,
          product_id: item.product_id,
          physical_qty: item.physical_qty,
          expected_qty: item.expected_qty,
        })));
        if (itemError) throw itemError;
      }

      return report;
    });
  },
};

async function queueOrExecute(type, payload, fn) {
  if (!navigator.onLine) {
    queueMutation(type, payload);
    return { queued: true };
  }
  return fn();
}
