import { requireSupabase } from '../core/supabaseClient.js';

export const stockRepository = {
  async expectedStockMap(shiftId) {
    const client = requireSupabase();
    const { data, error } = await client.rpc('expected_stock_for_shift', {
      target_shift_id: shiftId,
    });
    if (error) throw error;
    return new Map((data || []).map((row) => [row.product_id, Number(row.expected_qty || 0)]));
  },
};
