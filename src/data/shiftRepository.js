import { requireSupabase } from '../core/supabaseClient.js';
import { compressImage } from '../core/image.js';
import { getCurrentPosition, geofenceStatus } from '../core/geo.js';
import { uid } from '../core/utils.js';
import { store } from '../core/store.js';

const PHOTO_BUCKET = 'shift-photos';

export const shiftRepository = {
  async loadActiveShift(employeeId = null) {
    const state = store.getState();
    const cached = state.activeShift;
    if (cached && (!employeeId || cached.employee_id === employeeId)) return cached;
    if (!cached && state.activeShiftCheckedFor === (employeeId || 'all')) return null;

    const client = requireSupabase();
    const profile = store.getState().profile;
    const query = client
      .from('shifts')
      .select('*, outlets(*), employees(*)')
      .in('status', ['draft', 'active', 'final_reported'])
      .order('created_at', { ascending: false })
      .limit(1);

    if (profile?.role === 'employee' && employeeId) query.eq('employee_id', employeeId);

    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    store.setState({ activeShift: data || null, activeShiftCheckedFor: employeeId || 'all' });
    return data || null;
  },

  async uploadPhoto({ tenantId, shiftId, file, folder }) {
    if (!file) return null;
    if (!navigator.onLine) throw new Error('Upload foto membutuhkan koneksi online.');

    const client = requireSupabase();
    const compressed = await compressImage(file);
    const path = `${tenantId}/${shiftId || 'pending'}/${folder}/${uid('photo')}.jpg`;
    const { error } = await client.storage
      .from(PHOTO_BUCKET)
      .upload(path, compressed, { upsert: false, contentType: compressed.type });
    if (error) throw error;
    return path;
  },

  async checkIn({ outlet, employee, photoFile }) {
    const client = requireSupabase();
    const profile = store.getState().profile;
    const location = await getCurrentPosition();
    const center = { lat: Number(outlet.pickup_lat), lng: Number(outlet.pickup_lng) };
    const fence = geofenceStatus(location, center, outlet.geofence_radius_m);

    if (fence.inside === false) {
      throw new Error(`Di luar radius lokasi ambil barang. Jarak ${Math.round(fence.distance)} meter.`);
    }

    const shiftId = crypto.randomUUID();
    const shiftPayload = {
      id: shiftId,
      tenant_id: profile.tenant_id,
      employee_id: employee.id,
      outlet_id: outlet.id,
      status: 'active',
      checkin_at: new Date().toISOString(),
      checkin_lat: location.lat,
      checkin_lng: location.lng,
      checkin_accuracy_m: location.accuracy,
      checkin_distance_m: fence.distance,
    };

    const { data: createdShift, error } = await client.from('shifts').insert(shiftPayload).select('*, outlets(*)').single();
    if (error) throw error;

    const photoPath = await this.uploadPhoto({
      tenantId: profile.tenant_id,
      shiftId,
      file: photoFile,
      folder: 'check-in',
    });

    const { data, error: updateError } = await client
      .from('shifts')
      .update({ checkin_photo_path: photoPath })
      .eq('id', createdShift.id)
      .select('*, outlets(*)')
      .single();
    if (updateError) throw updateError;

    await client.from('attendance_events').insert({
      tenant_id: profile.tenant_id,
      shift_id: shiftId,
      employee_id: employee.id,
      outlet_id: outlet.id,
      type: 'check_in',
      lat: location.lat,
      lng: location.lng,
      accuracy_m: location.accuracy,
      distance_m: fence.distance,
      photo_path: photoPath,
      inside_geofence: fence.inside,
    });

    store.setState({ activeShift: data, activeShiftCheckedFor: employee.id });
    return data;
  },

  async getSuggestedOpeningStock(outlet, products) {
    const client = requireSupabase();
    if (outlet.stock_default_method === 'default_qty') {
      return products.map((product) => ({ product, qty: product.default_qty || 0, source: 'default_qty' }));
    }

    const { data, error } = await client
      .from('final_report_items')
      .select('product_id, ending_qty, final_reports!inner(outlet_id, reported_at)')
      .eq('final_reports.outlet_id', outlet.id)
      .order('created_at', { ascending: false });
    if (error) throw error;

    const lastByProduct = new Map();
    (data || []).forEach((row) => {
      if (!lastByProduct.has(row.product_id)) lastByProduct.set(row.product_id, row.ending_qty);
    });

    return products.map((product) => ({
      product,
      qty: lastByProduct.get(product.id) ?? product.default_qty ?? 0,
      source: lastByProduct.has(product.id) ? 'previous_remaining' : 'default_qty',
    }));
  },

  async submitInitialReport({ shift, openingCash, note, stockItems }) {
    const client = requireSupabase();
    const reportPayload = {
      tenant_id: shift.tenant_id,
      shift_id: shift.id,
      employee_id: shift.employee_id,
      outlet_id: shift.outlet_id,
      opening_cash: openingCash,
      note,
    };

    const { data: report, error } = await client
      .from('initial_reports')
      .insert(reportPayload)
      .select()
      .single();
    if (error) throw error;

    const rows = stockItems.map((item) => ({
      tenant_id: shift.tenant_id,
      initial_report_id: report.id,
      shift_id: shift.id,
      product_id: item.product_id,
      qty: item.qty,
      source: item.source,
    }));

    if (rows.length) {
      const { error: stockError } = await client.from('initial_stock_items').insert(rows);
      if (stockError) throw stockError;
    }

    const { data: updatedShift, error: shiftError } = await client
      .from('shifts')
      .update({ initial_report_submitted_at: new Date().toISOString() })
      .eq('id', shift.id)
      .select('*, outlets(*)')
      .single();
    if (shiftError) throw shiftError;

    store.setState({ activeShift: updatedShift, activeShiftCheckedFor: shift.employee_id });
    return report;
  },

  async submitFinalReport({ shift, values, stockItems }) {
    const client = requireSupabase();
    const reportPayload = {
      tenant_id: shift.tenant_id,
      shift_id: shift.id,
      employee_id: shift.employee_id,
      outlet_id: shift.outlet_id,
      cash_amount: values.cash_amount,
      qris_amount: values.qris_amount,
      transfer_amount: values.transfer_amount,
      receivable_amount: values.receivable_amount,
      cash_deposit_amount: values.cash_deposit_amount,
      continue_shift: values.continue_shift,
      note: values.note,
    };

    const { data: report, error } = await client
      .from('final_reports')
      .insert(reportPayload)
      .select()
      .single();
    if (error) throw error;

    if (stockItems.length) {
      const { error: itemError } = await client.from('final_report_items').insert(stockItems.map((item) => ({
        tenant_id: shift.tenant_id,
        final_report_id: report.id,
        shift_id: shift.id,
        product_id: item.product_id,
        ending_qty: item.ending_qty,
        expected_qty: item.expected_qty,
      })));
      if (itemError) throw itemError;
    }

    const { data: updatedShift, error: shiftError } = await client
      .from('shifts')
      .update({
        final_report_submitted_at: new Date().toISOString(),
        continue_shift: values.continue_shift,
        status: values.continue_shift ? 'active' : 'final_reported',
      })
      .eq('id', shift.id)
      .select('*, outlets(*)')
      .single();
    if (shiftError) throw shiftError;
    store.setState({ activeShift: updatedShift, activeShiftCheckedFor: shift.employee_id });
    return report;
  },

  async checkOut({ shift, photoFile }) {
    const client = requireSupabase();
    const location = await getCurrentPosition();
    const outlet = shift.outlets;
    const center = {
      lat: Number(outlet.checkout_lat || outlet.sale_lat),
      lng: Number(outlet.checkout_lng || outlet.sale_lng),
    };
    const fence = geofenceStatus(location, center, outlet.geofence_radius_m);

    if (fence.inside === false) {
      throw new Error(`Di luar radius lokasi absen pulang. Jarak ${Math.round(fence.distance)} meter.`);
    }

    const photoPath = await this.uploadPhoto({
      tenantId: shift.tenant_id,
      shiftId: shift.id,
      file: photoFile,
      folder: 'check-out',
    });

    const { data, error } = await client
      .from('shifts')
      .update({
        status: 'closed',
        checkout_at: new Date().toISOString(),
        checkout_lat: location.lat,
        checkout_lng: location.lng,
        checkout_accuracy_m: location.accuracy,
        checkout_distance_m: fence.distance,
        checkout_photo_path: photoPath,
      })
      .eq('id', shift.id)
      .select('*, outlets(*)')
      .single();
    if (error) throw error;

    await client.from('attendance_events').insert({
      tenant_id: shift.tenant_id,
      shift_id: shift.id,
      employee_id: shift.employee_id,
      outlet_id: shift.outlet_id,
      type: 'check_out',
      lat: location.lat,
      lng: location.lng,
      accuracy_m: location.accuracy,
      distance_m: fence.distance,
      photo_path: photoPath,
      inside_geofence: fence.inside,
    });

    store.setState({ activeShift: null, activeShiftCheckedFor: shift.employee_id });
    return data;
  },

  async sendLocationPing(shift) {
    const client = requireSupabase();
    const location = await getCurrentPosition({ maximumAge: 120000 });
    const outlet = shift.outlets;
    const fence = geofenceStatus(location, {
      lat: Number(outlet.sale_lat),
      lng: Number(outlet.sale_lng),
    }, outlet.geofence_radius_m);

    const { data, error } = await client
      .from('location_pings')
      .insert({
        tenant_id: shift.tenant_id,
        shift_id: shift.id,
        employee_id: shift.employee_id,
        outlet_id: shift.outlet_id,
        lat: location.lat,
        lng: location.lng,
        accuracy_m: location.accuracy,
        distance_from_outlet_m: fence.distance,
        inside_radius: fence.inside,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};
