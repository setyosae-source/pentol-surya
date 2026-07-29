-- Pentol Surya demo data seed.
-- Run after:
-- 1. supabase/migrations/001_initial_schema.sql has been applied.
-- 2. Owner profile already exists in public.user_profiles.
-- 3. At least one employee has been created from the app Settings page.
--
-- Recommended demo employees:
-- DEMO-001 / +628110000001 / PIN 111111
-- DEMO-002 / +628110000002 / PIN 222222
-- DEMO-003 / +628110000003 / PIN 333333
--
-- The seed is safe to rerun. It clears only rows marked with DEMO notes/names,
-- then recreates complete operational sample data for the current tenant.

do $$
declare
  v_owner_id uuid;
  v_tenant_id uuid;
  v_employee_ids uuid[];
  v_emp_1 uuid;
  v_emp_2 uuid;
  v_emp_3 uuid;

  v_outlet_1 uuid;
  v_outlet_2 uuid;
  v_outlet_3 uuid;

  v_cat_pentol uuid;
  v_cat_minuman uuid;

  v_prod_original uuid;
  v_prod_urat uuid;
  v_prod_pedas uuid;
  v_prod_tahu uuid;
  v_prod_es_teh uuid;
  v_prod_air uuid;

  v_shift_active uuid := gen_random_uuid();
  v_shift_closed uuid := gen_random_uuid();
  v_shift_reported uuid := gen_random_uuid();

  v_initial_report uuid;
  v_periodic_report uuid;
  v_final_report uuid;
  v_sale uuid;
  v_supply uuid;
  v_payroll_period uuid;
  v_emp uuid;
  v_hourly_rate numeric;
  v_meal_allowance numeric;
  v_transport_allowance numeric;

  v_today date := current_date;
  v_yesterday date := current_date - 1;
  v_start_week date := current_date - extract(dow from current_date)::integer;
begin
  select id, tenant_id
    into v_owner_id, v_tenant_id
  from public.user_profiles
  where role = 'owner'
    and active = true
  order by created_at
  limit 1;

  if v_tenant_id is null then
    raise exception 'Owner profile belum ada. Buat user owner di Auth, lalu isi public.user_profiles role owner.';
  end if;

  perform set_config('request.jwt.claim.sub', v_owner_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  select array_agg(id order by case when employee_code like 'DEMO-%' then 0 else 1 end, employee_code, created_at)
    into v_employee_ids
  from public.employees
  where tenant_id = v_tenant_id
    and active = true;

  if coalesce(array_length(v_employee_ids, 1), 0) = 0 then
    raise exception 'Belum ada karyawan. Buat minimal 1 karyawan dari menu Setting, lalu jalankan seed ini lagi.';
  end if;

  v_emp_1 := v_employee_ids[1];
  v_emp_2 := coalesce(v_employee_ids[2], v_employee_ids[1]);
  v_emp_3 := coalesce(v_employee_ids[3], v_employee_ids[1]);

  insert into public.product_categories (tenant_id, name, sort_order, active)
  values
    (v_tenant_id, 'Pentol', 10, true),
    (v_tenant_id, 'Minuman', 20, true)
  on conflict (tenant_id, name) do update
  set sort_order = excluded.sort_order,
      active = true,
      updated_at = now();

  select id into v_cat_pentol
  from public.product_categories
  where tenant_id = v_tenant_id and name = 'Pentol';

  select id into v_cat_minuman
  from public.product_categories
  where tenant_id = v_tenant_id and name = 'Minuman';

  insert into public.products (tenant_id, category_id, name, general_sale_price, default_qty, active)
  values (v_tenant_id, v_cat_pentol, 'DEMO - Pentol Original', 10000, 80, true)
  on conflict (tenant_id, name) do update
  set category_id = excluded.category_id,
      general_sale_price = excluded.general_sale_price,
      default_qty = excluded.default_qty,
      active = true,
      updated_at = now()
  returning id into v_prod_original;

  insert into public.products (tenant_id, category_id, name, general_sale_price, default_qty, active)
  values (v_tenant_id, v_cat_pentol, 'DEMO - Pentol Urat', 12000, 60, true)
  on conflict (tenant_id, name) do update
  set category_id = excluded.category_id,
      general_sale_price = excluded.general_sale_price,
      default_qty = excluded.default_qty,
      active = true,
      updated_at = now()
  returning id into v_prod_urat;

  insert into public.products (tenant_id, category_id, name, general_sale_price, default_qty, active)
  values (v_tenant_id, v_cat_pentol, 'DEMO - Pentol Pedas', 12000, 50, true)
  on conflict (tenant_id, name) do update
  set category_id = excluded.category_id,
      general_sale_price = excluded.general_sale_price,
      default_qty = excluded.default_qty,
      active = true,
      updated_at = now()
  returning id into v_prod_pedas;

  insert into public.products (tenant_id, category_id, name, general_sale_price, default_qty, active)
  values (v_tenant_id, v_cat_pentol, 'DEMO - Tahu Bakso', 8000, 40, true)
  on conflict (tenant_id, name) do update
  set category_id = excluded.category_id,
      general_sale_price = excluded.general_sale_price,
      default_qty = excluded.default_qty,
      active = true,
      updated_at = now()
  returning id into v_prod_tahu;

  insert into public.products (tenant_id, category_id, name, general_sale_price, default_qty, active)
  values (v_tenant_id, v_cat_minuman, 'DEMO - Es Teh', 5000, 30, true)
  on conflict (tenant_id, name) do update
  set category_id = excluded.category_id,
      general_sale_price = excluded.general_sale_price,
      default_qty = excluded.default_qty,
      active = true,
      updated_at = now()
  returning id into v_prod_es_teh;

  insert into public.products (tenant_id, category_id, name, general_sale_price, default_qty, active)
  values (v_tenant_id, v_cat_minuman, 'DEMO - Air Mineral', 4000, 24, true)
  on conflict (tenant_id, name) do update
  set category_id = excluded.category_id,
      general_sale_price = excluded.general_sale_price,
      default_qty = excluded.default_qty,
      active = true,
      updated_at = now()
  returning id into v_prod_air;

  delete from public.product_costs
  where tenant_id = v_tenant_id
    and product_id in (v_prod_original, v_prod_urat, v_prod_pedas, v_prod_tahu, v_prod_es_teh, v_prod_air);

  insert into public.product_costs (tenant_id, product_id, hpp, valid_from, created_by)
  values
    (v_tenant_id, v_prod_original, 4500, now() - interval '30 days', v_owner_id),
    (v_tenant_id, v_prod_urat, 6000, now() - interval '30 days', v_owner_id),
    (v_tenant_id, v_prod_pedas, 5500, now() - interval '30 days', v_owner_id),
    (v_tenant_id, v_prod_tahu, 3500, now() - interval '30 days', v_owner_id),
    (v_tenant_id, v_prod_es_teh, 1500, now() - interval '30 days', v_owner_id),
    (v_tenant_id, v_prod_air, 2000, now() - interval '30 days', v_owner_id);

  select id into v_outlet_1
  from public.outlets
  where tenant_id = v_tenant_id and name = 'DEMO - Outlet Harapan Jaya'
  limit 1;

  if v_outlet_1 is null then
    insert into public.outlets (
      tenant_id, name, address, pickup_lat, pickup_lng, sale_lat, sale_lng,
      checkout_lat, checkout_lng, geofence_radius_m, report_schedule_mode,
      report_times, stock_default_method, active
    )
    values (
      v_tenant_id, 'DEMO - Outlet Harapan Jaya', 'Jl. Demo Harapan Jaya, Bekasi Utara',
      -6.2005100, 107.0072500, -6.1968500, 107.0046500,
      -6.1968500, 107.0046500, 150, 'scheduled',
      array['10:00'::time, '13:00'::time, '16:00'::time], 'default_qty', true
    )
    returning id into v_outlet_1;
  else
    update public.outlets
    set address = 'Jl. Demo Harapan Jaya, Bekasi Utara',
        pickup_lat = -6.2005100,
        pickup_lng = 107.0072500,
        sale_lat = -6.1968500,
        sale_lng = 107.0046500,
        checkout_lat = -6.1968500,
        checkout_lng = 107.0046500,
        geofence_radius_m = 150,
        report_schedule_mode = 'scheduled',
        report_times = array['10:00'::time, '13:00'::time, '16:00'::time],
        stock_default_method = 'default_qty',
        active = true
    where id = v_outlet_1;
  end if;

  select id into v_outlet_2
  from public.outlets
  where tenant_id = v_tenant_id and name = 'DEMO - Outlet Teluk Pucung'
  limit 1;

  if v_outlet_2 is null then
    insert into public.outlets (
      tenant_id, name, address, pickup_lat, pickup_lng, sale_lat, sale_lng,
      checkout_lat, checkout_lng, geofence_radius_m, report_schedule_mode,
      report_times, stock_default_method, active
    )
    values (
      v_tenant_id, 'DEMO - Outlet Teluk Pucung', 'Jl. Demo Teluk Pucung, Bekasi Utara',
      -6.2183200, 107.0133200, -6.2141100, 107.0109000,
      -6.2141100, 107.0109000, 120, 'free',
      array[]::time[], 'previous_remaining', true
    )
    returning id into v_outlet_2;
  else
    update public.outlets
    set address = 'Jl. Demo Teluk Pucung, Bekasi Utara',
        pickup_lat = -6.2183200,
        pickup_lng = 107.0133200,
        sale_lat = -6.2141100,
        sale_lng = 107.0109000,
        checkout_lat = -6.2141100,
        checkout_lng = 107.0109000,
        geofence_radius_m = 120,
        report_schedule_mode = 'free',
        report_times = array[]::time[],
        stock_default_method = 'previous_remaining',
        active = true
    where id = v_outlet_2;
  end if;

  select id into v_outlet_3
  from public.outlets
  where tenant_id = v_tenant_id and name = 'DEMO - Outlet Babelan'
  limit 1;

  if v_outlet_3 is null then
    insert into public.outlets (
      tenant_id, name, address, pickup_lat, pickup_lng, sale_lat, sale_lng,
      checkout_lat, checkout_lng, geofence_radius_m, report_schedule_mode,
      report_times, stock_default_method, active
    )
    values (
      v_tenant_id, 'DEMO - Outlet Babelan', 'Jl. Demo Babelan, Bekasi',
      -6.1644200, 107.0311100, -6.1606500, 107.0299200,
      -6.1606500, 107.0299200, 180, 'scheduled',
      array['11:00'::time, '15:00'::time], 'default_qty', true
    )
    returning id into v_outlet_3;
  else
    update public.outlets
    set address = 'Jl. Demo Babelan, Bekasi',
        pickup_lat = -6.1644200,
        pickup_lng = 107.0311100,
        sale_lat = -6.1606500,
        sale_lng = 107.0299200,
        checkout_lat = -6.1606500,
        checkout_lng = 107.0299200,
        geofence_radius_m = 180,
        report_schedule_mode = 'scheduled',
        report_times = array['11:00'::time, '15:00'::time],
        stock_default_method = 'default_qty',
        active = true
    where id = v_outlet_3;
  end if;

  delete from public.cash_deposits
  where tenant_id = v_tenant_id
    and note like 'DEMO:%';

  delete from public.general_expenses
  where tenant_id = v_tenant_id
    and note like 'DEMO:%';

  delete from public.payroll_periods
  where tenant_id = v_tenant_id
    and name like 'DEMO - %';

  delete from public.shifts
  where tenant_id = v_tenant_id
    and notes like 'DEMO:%';

  delete from public.outlet_assignments
  where tenant_id = v_tenant_id
    and starts_on = v_today - 7
    and outlet_id in (v_outlet_1, v_outlet_2, v_outlet_3)
    and employee_id = any(array[v_emp_1, v_emp_2, v_emp_3]);

  delete from public.outlet_product_prices
  where tenant_id = v_tenant_id
    and (
      outlet_id in (v_outlet_1, v_outlet_2, v_outlet_3)
      or product_id in (v_prod_original, v_prod_urat, v_prod_pedas, v_prod_tahu, v_prod_es_teh, v_prod_air)
    );

  insert into public.outlet_product_prices (tenant_id, outlet_id, product_id, sale_price, active, valid_from, created_by)
  values
    (v_tenant_id, v_outlet_1, v_prod_original, 11000, true, now() - interval '10 days', v_owner_id),
    (v_tenant_id, v_outlet_1, v_prod_pedas, 13000, true, now() - interval '10 days', v_owner_id),
    (v_tenant_id, v_outlet_2, v_prod_urat, 12500, true, now() - interval '10 days', v_owner_id),
    (v_tenant_id, v_outlet_2, v_prod_tahu, 8500, true, now() - interval '10 days', v_owner_id),
    (v_tenant_id, v_outlet_3, v_prod_original, 10500, true, now() - interval '10 days', v_owner_id),
    (v_tenant_id, v_outlet_3, v_prod_es_teh, 6000, true, now() - interval '10 days', v_owner_id);

  insert into public.outlet_assignments (tenant_id, employee_id, outlet_id, starts_on, locked_by_owner, active)
  values
    (v_tenant_id, v_emp_1, v_outlet_1, v_today - 7, true, true),
    (v_tenant_id, v_emp_2, v_outlet_2, v_today - 7, true, true),
    (v_tenant_id, v_emp_3, v_outlet_3, v_today - 7, false, true);

  insert into public.shifts (
    id, tenant_id, employee_id, outlet_id, status, checkin_at, checkin_lat,
    checkin_lng, checkin_accuracy_m, checkin_distance_m, checkin_photo_path,
    initial_report_submitted_at, notes, created_at
  )
  values (
    v_shift_active, v_tenant_id, v_emp_1, v_outlet_1, 'active',
    (v_today + time '07:05') at time zone 'Asia/Jakarta',
    -6.2005000, 107.0072600, 12, 8,
    v_tenant_id::text || '/' || v_shift_active::text || '/check-in/demo-check-in.jpg',
    (v_today + time '07:18') at time zone 'Asia/Jakarta',
    'DEMO: shift aktif dengan transaksi lengkap',
    (v_today + time '07:05') at time zone 'Asia/Jakarta'
  );

  insert into public.attendance_events (
    tenant_id, shift_id, employee_id, outlet_id, type, lat, lng, accuracy_m,
    distance_m, photo_path, inside_geofence, created_at
  )
  values (
    v_tenant_id, v_shift_active, v_emp_1, v_outlet_1, 'check_in',
    -6.2005000, 107.0072600, 12, 8,
    v_tenant_id::text || '/' || v_shift_active::text || '/check-in/demo-check-in.jpg',
    true, (v_today + time '07:05') at time zone 'Asia/Jakarta'
  );

  insert into public.initial_reports (tenant_id, shift_id, employee_id, outlet_id, opening_cash, note, created_at)
  values (
    v_tenant_id, v_shift_active, v_emp_1, v_outlet_1, 300000,
    'DEMO: stok awal dari qty default',
    (v_today + time '07:18') at time zone 'Asia/Jakarta'
  )
  returning id into v_initial_report;

  insert into public.initial_stock_items (tenant_id, initial_report_id, shift_id, product_id, qty, source)
  values
    (v_tenant_id, v_initial_report, v_shift_active, v_prod_original, 80, 'default_qty'),
    (v_tenant_id, v_initial_report, v_shift_active, v_prod_urat, 60, 'default_qty'),
    (v_tenant_id, v_initial_report, v_shift_active, v_prod_pedas, 50, 'default_qty'),
    (v_tenant_id, v_initial_report, v_shift_active, v_prod_tahu, 40, 'default_qty'),
    (v_tenant_id, v_initial_report, v_shift_active, v_prod_es_teh, 30, 'default_qty'),
    (v_tenant_id, v_initial_report, v_shift_active, v_prod_air, 24, 'default_qty');

  insert into public.sales (
    tenant_id, shift_id, employee_id, outlet_id, payment_method, customer_name,
    customer_phone, note, client_ref, occurred_at
  )
  values (
    v_tenant_id, v_shift_active, v_emp_1, v_outlet_1, 'cash',
    'Pelanggan Cash Demo', null, 'DEMO: transaksi cash campuran',
    'DEMO-ACTIVE-CASH-001', (v_today + time '08:12') at time zone 'Asia/Jakarta'
  )
  returning id into v_sale;

  insert into public.sale_items (tenant_id, sale_id, shift_id, product_id, qty, unit_price_snapshot, hpp_snapshot)
  values
    (v_tenant_id, v_sale, v_shift_active, v_prod_original, 5, 11000, 0),
    (v_tenant_id, v_sale, v_shift_active, v_prod_urat, 3, 12000, 0),
    (v_tenant_id, v_sale, v_shift_active, v_prod_es_teh, 2, 5000, 0);

  insert into public.sales (
    tenant_id, shift_id, employee_id, outlet_id, payment_method, customer_name,
    customer_phone, note, client_ref, occurred_at
  )
  values (
    v_tenant_id, v_shift_active, v_emp_1, v_outlet_1, 'qris',
    'Pelanggan QRIS Demo', null, 'DEMO: transaksi QRIS',
    'DEMO-ACTIVE-QRIS-001', (v_today + time '09:35') at time zone 'Asia/Jakarta'
  )
  returning id into v_sale;

  insert into public.sale_items (tenant_id, sale_id, shift_id, product_id, qty, unit_price_snapshot, hpp_snapshot)
  values
    (v_tenant_id, v_sale, v_shift_active, v_prod_pedas, 4, 13000, 0),
    (v_tenant_id, v_sale, v_shift_active, v_prod_air, 3, 4000, 0);

  insert into public.sales (
    tenant_id, shift_id, employee_id, outlet_id, payment_method, customer_name,
    customer_phone, note, client_ref, occurred_at
  )
  values (
    v_tenant_id, v_shift_active, v_emp_1, v_outlet_1, 'transfer',
    'Pelanggan Transfer Demo', null, 'DEMO: transaksi transfer',
    'DEMO-ACTIVE-TRANSFER-001', (v_today + time '10:20') at time zone 'Asia/Jakarta'
  )
  returning id into v_sale;

  insert into public.sale_items (tenant_id, sale_id, shift_id, product_id, qty, unit_price_snapshot, hpp_snapshot)
  values (v_tenant_id, v_sale, v_shift_active, v_prod_tahu, 2, 8000, 0);

  insert into public.sales (
    tenant_id, shift_id, employee_id, outlet_id, payment_method, customer_name,
    customer_phone, note, client_ref, occurred_at
  )
  values (
    v_tenant_id, v_shift_active, v_emp_1, v_outlet_1, 'piutang',
    'Warung Tetangga Demo', '+628111111111', 'DEMO: transaksi piutang',
    'DEMO-ACTIVE-PIUTANG-001', (v_today + time '11:05') at time zone 'Asia/Jakarta'
  )
  returning id into v_sale;

  insert into public.sale_items (tenant_id, sale_id, shift_id, product_id, qty, unit_price_snapshot, hpp_snapshot)
  values (v_tenant_id, v_sale, v_shift_active, v_prod_original, 3, 11000, 0);

  insert into public.outlet_expenses (tenant_id, shift_id, employee_id, outlet_id, category, amount, note, occurred_at)
  values (
    v_tenant_id, v_shift_active, v_emp_1, v_outlet_1, 'Parkir',
    15000, 'DEMO: pengeluaran outlet tanpa approval',
    (v_today + time '09:10') at time zone 'Asia/Jakarta'
  );

  insert into public.supplies (tenant_id, shift_id, employee_id, outlet_id, source_name, source_role, note, supplied_at, created_by)
  values (
    v_tenant_id, v_shift_active, v_emp_1, v_outlet_1, 'Gudang pusat demo',
    'owner', 'DEMO: supply tambahan dari owner',
    (v_today + time '10:45') at time zone 'Asia/Jakarta',
    v_owner_id
  )
  returning id into v_supply;

  insert into public.supply_items (tenant_id, supply_id, shift_id, product_id, qty, unit_hpp_snapshot)
  values
    (v_tenant_id, v_supply, v_shift_active, v_prod_original, 20, 0),
    (v_tenant_id, v_supply, v_shift_active, v_prod_pedas, 10, 0);

  insert into public.waste_items (tenant_id, shift_id, employee_id, outlet_id, product_id, qty, reason, unit_hpp_snapshot, photo_path, wasted_at)
  values (
    v_tenant_id, v_shift_active, v_emp_1, v_outlet_1, v_prod_original,
    2, 'DEMO: pentol jatuh saat ramai', 0,
    v_tenant_id::text || '/' || v_shift_active::text || '/waste/demo-waste.jpg',
    (v_today + time '11:30') at time zone 'Asia/Jakarta'
  );

  insert into public.periodic_reports (
    tenant_id, shift_id, employee_id, outlet_id, cash_amount,
    qris_amount, transfer_amount, note, reported_at
  )
  values (
    v_tenant_id, v_shift_active, v_emp_1, v_outlet_1,
    385000, 64000, 16000, 'DEMO: laporan berkala ada selisih cash 1000',
    (v_today + time '12:00') at time zone 'Asia/Jakarta'
  )
  returning id into v_periodic_report;

  insert into public.periodic_report_items (tenant_id, periodic_report_id, shift_id, product_id, physical_qty, expected_qty)
  values
    (v_tenant_id, v_periodic_report, v_shift_active, v_prod_original, 89, 90),
    (v_tenant_id, v_periodic_report, v_shift_active, v_prod_urat, 57, 57),
    (v_tenant_id, v_periodic_report, v_shift_active, v_prod_pedas, 56, 56),
    (v_tenant_id, v_periodic_report, v_shift_active, v_prod_tahu, 38, 38),
    (v_tenant_id, v_periodic_report, v_shift_active, v_prod_es_teh, 28, 28),
    (v_tenant_id, v_periodic_report, v_shift_active, v_prod_air, 21, 21);

  insert into public.location_pings (
    tenant_id, shift_id, employee_id, outlet_id, lat, lng, accuracy_m,
    distance_from_outlet_m, inside_radius, battery_percent, created_at
  )
  values
    (v_tenant_id, v_shift_active, v_emp_1, v_outlet_1, -6.1968600, 107.0046600, 14, 7, true, 88, (v_today + time '08:00') at time zone 'Asia/Jakarta'),
    (v_tenant_id, v_shift_active, v_emp_1, v_outlet_1, -6.1969000, 107.0047000, 12, 12, true, 82, (v_today + time '10:00') at time zone 'Asia/Jakarta'),
    (v_tenant_id, v_shift_active, v_emp_1, v_outlet_1, -6.1943000, 107.0018000, 18, 420, false, 76, now());

  insert into public.shifts (
    id, tenant_id, employee_id, outlet_id, status, checkin_at, checkin_lat,
    checkin_lng, checkin_accuracy_m, checkin_distance_m, checkin_photo_path,
    initial_report_submitted_at, final_report_submitted_at, checkout_at,
    checkout_lat, checkout_lng, checkout_accuracy_m, checkout_distance_m,
    checkout_photo_path, continue_shift, notes, created_at
  )
  values (
    v_shift_closed, v_tenant_id, v_emp_2, v_outlet_2, 'closed',
    (v_today + time '06:50') at time zone 'Asia/Jakarta',
    -6.2183300, 107.0133100, 10, 5,
    v_tenant_id::text || '/' || v_shift_closed::text || '/check-in/demo-check-in.jpg',
    (v_today + time '07:03') at time zone 'Asia/Jakarta',
    (v_today + time '17:05') at time zone 'Asia/Jakarta',
    (v_today + time '17:25') at time zone 'Asia/Jakarta',
    -6.2141000, 107.0109100, 12, 9,
    v_tenant_id::text || '/' || v_shift_closed::text || '/check-out/demo-check-out.jpg',
    false, 'DEMO: shift sudah tutup lengkap',
    (v_today + time '06:50') at time zone 'Asia/Jakarta'
  );

  insert into public.attendance_events (tenant_id, shift_id, employee_id, outlet_id, type, lat, lng, accuracy_m, distance_m, photo_path, inside_geofence, created_at)
  values
    (v_tenant_id, v_shift_closed, v_emp_2, v_outlet_2, 'check_in', -6.2183300, 107.0133100, 10, 5, v_tenant_id::text || '/' || v_shift_closed::text || '/check-in/demo-check-in.jpg', true, (v_today + time '06:50') at time zone 'Asia/Jakarta'),
    (v_tenant_id, v_shift_closed, v_emp_2, v_outlet_2, 'check_out', -6.2141000, 107.0109100, 12, 9, v_tenant_id::text || '/' || v_shift_closed::text || '/check-out/demo-check-out.jpg', true, (v_today + time '17:25') at time zone 'Asia/Jakarta');

  insert into public.initial_reports (tenant_id, shift_id, employee_id, outlet_id, opening_cash, note, created_at)
  values (v_tenant_id, v_shift_closed, v_emp_2, v_outlet_2, 250000, 'DEMO: stok awal dari sisa shift sebelumnya', (v_today + time '07:03') at time zone 'Asia/Jakarta')
  returning id into v_initial_report;

  insert into public.initial_stock_items (tenant_id, initial_report_id, shift_id, product_id, qty, source)
  values
    (v_tenant_id, v_initial_report, v_shift_closed, v_prod_original, 90, 'previous_remaining'),
    (v_tenant_id, v_initial_report, v_shift_closed, v_prod_urat, 70, 'previous_remaining'),
    (v_tenant_id, v_initial_report, v_shift_closed, v_prod_pedas, 55, 'previous_remaining'),
    (v_tenant_id, v_initial_report, v_shift_closed, v_prod_tahu, 45, 'previous_remaining'),
    (v_tenant_id, v_initial_report, v_shift_closed, v_prod_es_teh, 35, 'previous_remaining'),
    (v_tenant_id, v_initial_report, v_shift_closed, v_prod_air, 30, 'previous_remaining');

  insert into public.sales (tenant_id, shift_id, employee_id, outlet_id, payment_method, customer_name, note, client_ref, occurred_at)
  values (v_tenant_id, v_shift_closed, v_emp_2, v_outlet_2, 'cash', 'Pembeli Siang Demo', 'DEMO: cash outlet 2', 'DEMO-CLOSED-CASH-001', (v_today + time '12:15') at time zone 'Asia/Jakarta')
  returning id into v_sale;

  insert into public.sale_items (tenant_id, sale_id, shift_id, product_id, qty, unit_price_snapshot, hpp_snapshot)
  values
    (v_tenant_id, v_sale, v_shift_closed, v_prod_original, 8, 10000, 0),
    (v_tenant_id, v_sale, v_shift_closed, v_prod_tahu, 4, 8500, 0);

  insert into public.sales (tenant_id, shift_id, employee_id, outlet_id, payment_method, customer_name, note, client_ref, occurred_at)
  values (v_tenant_id, v_shift_closed, v_emp_2, v_outlet_2, 'qris', 'Pembeli QRIS Demo', 'DEMO: qris outlet 2', 'DEMO-CLOSED-QRIS-001', (v_today + time '13:20') at time zone 'Asia/Jakarta')
  returning id into v_sale;

  insert into public.sale_items (tenant_id, sale_id, shift_id, product_id, qty, unit_price_snapshot, hpp_snapshot)
  values
    (v_tenant_id, v_sale, v_shift_closed, v_prod_urat, 5, 12500, 0),
    (v_tenant_id, v_sale, v_shift_closed, v_prod_es_teh, 5, 5000, 0);

  insert into public.sales (tenant_id, shift_id, employee_id, outlet_id, payment_method, customer_name, note, client_ref, occurred_at)
  values (v_tenant_id, v_shift_closed, v_emp_2, v_outlet_2, 'transfer', 'Pembeli Transfer Demo', 'DEMO: transfer outlet 2', 'DEMO-CLOSED-TRANSFER-001', (v_today + time '14:10') at time zone 'Asia/Jakarta')
  returning id into v_sale;

  insert into public.sale_items (tenant_id, sale_id, shift_id, product_id, qty, unit_price_snapshot, hpp_snapshot)
  values (v_tenant_id, v_sale, v_shift_closed, v_prod_pedas, 6, 12000, 0);

  insert into public.sales (tenant_id, shift_id, employee_id, outlet_id, payment_method, customer_name, customer_phone, note, client_ref, occurred_at)
  values (v_tenant_id, v_shift_closed, v_emp_2, v_outlet_2, 'piutang', 'Pelanggan Grosir Demo', '+628122222222', 'DEMO: piutang outlet 2', 'DEMO-CLOSED-PIUTANG-001', (v_today + time '15:00') at time zone 'Asia/Jakarta')
  returning id into v_sale;

  insert into public.sale_items (tenant_id, sale_id, shift_id, product_id, qty, unit_price_snapshot, hpp_snapshot)
  values (v_tenant_id, v_sale, v_shift_closed, v_prod_air, 10, 4000, 0);

  insert into public.outlet_expenses (tenant_id, shift_id, employee_id, outlet_id, category, amount, note, occurred_at)
  values (v_tenant_id, v_shift_closed, v_emp_2, v_outlet_2, 'Gas', 25000, 'DEMO: gas outlet', (v_today + time '10:00') at time zone 'Asia/Jakarta');

  insert into public.supplies (tenant_id, shift_id, employee_id, outlet_id, source_name, source_role, note, supplied_at, created_by)
  values (v_tenant_id, v_shift_closed, v_emp_2, v_outlet_2, 'Manager demo', 'manager', 'DEMO: supply tambahan siang', (v_today + time '12:45') at time zone 'Asia/Jakarta', v_owner_id)
  returning id into v_supply;

  insert into public.supply_items (tenant_id, supply_id, shift_id, product_id, qty, unit_hpp_snapshot)
  values
    (v_tenant_id, v_supply, v_shift_closed, v_prod_urat, 15, 0),
    (v_tenant_id, v_supply, v_shift_closed, v_prod_tahu, 10, 0);

  insert into public.waste_items (tenant_id, shift_id, employee_id, outlet_id, product_id, qty, reason, unit_hpp_snapshot, wasted_at)
  values (v_tenant_id, v_shift_closed, v_emp_2, v_outlet_2, v_prod_tahu, 1, 'DEMO: tahu sobek', 0, (v_today + time '16:10') at time zone 'Asia/Jakarta');

  insert into public.periodic_reports (tenant_id, shift_id, employee_id, outlet_id, cash_amount, qris_amount, transfer_amount, note, reported_at)
  values (v_tenant_id, v_shift_closed, v_emp_2, v_outlet_2, 339000, 87500, 72000, 'DEMO: laporan berkala outlet 2', (v_today + time '15:30') at time zone 'Asia/Jakarta')
  returning id into v_periodic_report;

  insert into public.periodic_report_items (tenant_id, periodic_report_id, shift_id, product_id, physical_qty, expected_qty)
  values
    (v_tenant_id, v_periodic_report, v_shift_closed, v_prod_original, 82, 82),
    (v_tenant_id, v_periodic_report, v_shift_closed, v_prod_urat, 80, 80),
    (v_tenant_id, v_periodic_report, v_shift_closed, v_prod_pedas, 49, 49),
    (v_tenant_id, v_periodic_report, v_shift_closed, v_prod_tahu, 50, 50),
    (v_tenant_id, v_periodic_report, v_shift_closed, v_prod_es_teh, 30, 30),
    (v_tenant_id, v_periodic_report, v_shift_closed, v_prod_air, 20, 20);

  insert into public.final_reports (
    tenant_id, shift_id, employee_id, outlet_id, cash_amount, qris_amount,
    transfer_amount, receivable_amount, cash_deposit_amount, continue_shift,
    note, reported_at
  )
  values (
    v_tenant_id, v_shift_closed, v_emp_2, v_outlet_2,
    339000, 87500, 72000, 40000, 300000, false,
    'DEMO: laporan akhir lengkap dan shift ditutup',
    (v_today + time '17:05') at time zone 'Asia/Jakarta'
  )
  returning id into v_final_report;

  insert into public.final_report_items (tenant_id, final_report_id, shift_id, product_id, ending_qty, expected_qty)
  values
    (v_tenant_id, v_final_report, v_shift_closed, v_prod_original, 82, 82),
    (v_tenant_id, v_final_report, v_shift_closed, v_prod_urat, 79, 80),
    (v_tenant_id, v_final_report, v_shift_closed, v_prod_pedas, 49, 49),
    (v_tenant_id, v_final_report, v_shift_closed, v_prod_tahu, 50, 50),
    (v_tenant_id, v_final_report, v_shift_closed, v_prod_es_teh, 30, 30),
    (v_tenant_id, v_final_report, v_shift_closed, v_prod_air, 20, 20);

  insert into public.location_pings (tenant_id, shift_id, employee_id, outlet_id, lat, lng, accuracy_m, distance_from_outlet_m, inside_radius, battery_percent, created_at)
  values
    (v_tenant_id, v_shift_closed, v_emp_2, v_outlet_2, -6.2141200, 107.0109200, 13, 8, true, 55, (v_today + time '15:00') at time zone 'Asia/Jakarta'),
    (v_tenant_id, v_shift_closed, v_emp_2, v_outlet_2, -6.2141000, 107.0109100, 10, 9, true, 48, (v_today + time '17:00') at time zone 'Asia/Jakarta');

  insert into public.shifts (
    id, tenant_id, employee_id, outlet_id, status, checkin_at, checkin_lat,
    checkin_lng, checkin_accuracy_m, checkin_distance_m, checkin_photo_path,
    initial_report_submitted_at, final_report_submitted_at, continue_shift,
    notes, created_at
  )
  values (
    v_shift_reported, v_tenant_id, v_emp_3, v_outlet_3, 'final_reported',
    (v_today + time '08:00') at time zone 'Asia/Jakarta',
    -6.1644000, 107.0311200, 18, 12,
    v_tenant_id::text || '/' || v_shift_reported::text || '/check-in/demo-check-in.jpg',
    (v_today + time '08:15') at time zone 'Asia/Jakarta',
    (v_today + time '16:30') at time zone 'Asia/Jakarta',
    false, 'DEMO: final report sudah masuk tapi belum absen pulang',
    (v_today + time '08:00') at time zone 'Asia/Jakarta'
  );

  insert into public.attendance_events (tenant_id, shift_id, employee_id, outlet_id, type, lat, lng, accuracy_m, distance_m, photo_path, inside_geofence, created_at)
  values (
    v_tenant_id, v_shift_reported, v_emp_3, v_outlet_3, 'check_in',
    -6.1644000, 107.0311200, 18, 12,
    v_tenant_id::text || '/' || v_shift_reported::text || '/check-in/demo-check-in.jpg',
    true, (v_today + time '08:00') at time zone 'Asia/Jakarta'
  );

  insert into public.initial_reports (tenant_id, shift_id, employee_id, outlet_id, opening_cash, note, created_at)
  values (v_tenant_id, v_shift_reported, v_emp_3, v_outlet_3, 200000, 'DEMO: stok awal outlet 3', (v_today + time '08:15') at time zone 'Asia/Jakarta')
  returning id into v_initial_report;

  insert into public.initial_stock_items (tenant_id, initial_report_id, shift_id, product_id, qty, source)
  values
    (v_tenant_id, v_initial_report, v_shift_reported, v_prod_original, 70, 'default_qty'),
    (v_tenant_id, v_initial_report, v_shift_reported, v_prod_urat, 55, 'default_qty'),
    (v_tenant_id, v_initial_report, v_shift_reported, v_prod_pedas, 45, 'default_qty'),
    (v_tenant_id, v_initial_report, v_shift_reported, v_prod_tahu, 35, 'default_qty'),
    (v_tenant_id, v_initial_report, v_shift_reported, v_prod_es_teh, 25, 'default_qty'),
    (v_tenant_id, v_initial_report, v_shift_reported, v_prod_air, 20, 'default_qty');

  insert into public.sales (tenant_id, shift_id, employee_id, outlet_id, payment_method, customer_name, note, client_ref, occurred_at)
  values (v_tenant_id, v_shift_reported, v_emp_3, v_outlet_3, 'cash', 'Pembeli Babelan Demo', 'DEMO: omzet outlet 3', 'DEMO-REPORTED-CASH-001', (v_today + time '12:00') at time zone 'Asia/Jakarta')
  returning id into v_sale;

  insert into public.sale_items (tenant_id, sale_id, shift_id, product_id, qty, unit_price_snapshot, hpp_snapshot)
  values
    (v_tenant_id, v_sale, v_shift_reported, v_prod_original, 10, 10500, 0),
    (v_tenant_id, v_sale, v_shift_reported, v_prod_pedas, 8, 12000, 0),
    (v_tenant_id, v_sale, v_shift_reported, v_prod_es_teh, 6, 6000, 0);

  insert into public.final_reports (
    tenant_id, shift_id, employee_id, outlet_id, cash_amount, qris_amount,
    transfer_amount, receivable_amount, cash_deposit_amount, continue_shift,
    note, reported_at
  )
  values (
    v_tenant_id, v_shift_reported, v_emp_3, v_outlet_3,
    437000, 0, 0, 0, 400000, false,
    'DEMO: laporan akhir masuk, absen pulang belum',
    (v_today + time '16:30') at time zone 'Asia/Jakarta'
  )
  returning id into v_final_report;

  insert into public.final_report_items (tenant_id, final_report_id, shift_id, product_id, ending_qty, expected_qty)
  values
    (v_tenant_id, v_final_report, v_shift_reported, v_prod_original, 60, 60),
    (v_tenant_id, v_final_report, v_shift_reported, v_prod_urat, 55, 55),
    (v_tenant_id, v_final_report, v_shift_reported, v_prod_pedas, 37, 37),
    (v_tenant_id, v_final_report, v_shift_reported, v_prod_tahu, 35, 35),
    (v_tenant_id, v_final_report, v_shift_reported, v_prod_es_teh, 19, 19),
    (v_tenant_id, v_final_report, v_shift_reported, v_prod_air, 20, 20);

  insert into public.location_pings (tenant_id, shift_id, employee_id, outlet_id, lat, lng, accuracy_m, distance_from_outlet_m, inside_radius, battery_percent, created_at)
  values (v_tenant_id, v_shift_reported, v_emp_3, v_outlet_3, -6.1606600, 107.0299100, 15, 6, true, 63, now() - interval '20 minutes');

  insert into public.general_expenses (tenant_id, category, amount, note, occurred_at, created_by)
  values
    (v_tenant_id, 'Belanja bahan baku', 350000, 'DEMO: pengeluaran umum bahan baku', v_today, v_owner_id),
    (v_tenant_id, 'Gas dapur', 90000, 'DEMO: pengeluaran umum gas', v_today, v_owner_id),
    (v_tenant_id, 'Sewa lapak', 750000, 'DEMO: pengeluaran umum kemarin untuk histori', v_yesterday, v_owner_id);

  insert into public.cash_deposits (tenant_id, shift_id, outlet_id, employee_id, amount, received_by, note, deposited_at)
  values
    (v_tenant_id, v_shift_closed, v_outlet_2, v_emp_2, 300000, v_owner_id, 'DEMO: setoran cash outlet 2 diterima owner', (v_today + time '18:10') at time zone 'Asia/Jakarta'),
    (v_tenant_id, v_shift_reported, v_outlet_3, v_emp_3, 400000, v_owner_id, 'DEMO: setoran cash outlet 3 diterima owner', (v_today + time '18:25') at time zone 'Asia/Jakarta');

  insert into public.payroll_periods (tenant_id, name, starts_on, ends_on, status, created_by)
  values (
    v_tenant_id,
    'DEMO - Gaji Minggu Ini',
    v_start_week,
    v_start_week + 6,
    'draft',
    v_owner_id
  )
  returning id into v_payroll_period;

  for v_emp in
    select distinct unnest(array[v_emp_1, v_emp_2, v_emp_3])
  loop
    select hourly_rate, meal_allowance, transport_allowance
      into v_hourly_rate, v_meal_allowance, v_transport_allowance
    from public.employees
    where id = v_emp;

    insert into public.payroll_items (
      tenant_id, payroll_period_id, employee_id, total_minutes, hourly_rate,
      wage_amount, meal_allowance, transport_allowance, bonus_amount,
      deduction_amount, total_amount, note
    )
    values (
      v_tenant_id, v_payroll_period, v_emp, 540,
      coalesce(v_hourly_rate, 5000),
      round((coalesce(v_hourly_rate, 5000) / 60) * 540, 2),
      coalesce(v_meal_allowance, 10000),
      coalesce(v_transport_allowance, 0),
      15000,
      0,
      round((coalesce(v_hourly_rate, 5000) / 60) * 540, 2)
        + coalesce(v_meal_allowance, 10000)
        + coalesce(v_transport_allowance, 0)
        + 15000,
      'DEMO: payroll draft dari jam kerja dummy'
    );
  end loop;

  insert into public.app_settings (tenant_id, key, value)
  values (
    v_tenant_id,
    'demo_data',
    jsonb_build_object(
      'enabled', true,
      'seeded_at', now(),
      'outlets', 3,
      'products', 6,
      'shifts', 3,
      'note', 'Pentol Surya demo data'
    )
  )
  on conflict (tenant_id, key) do update
  set value = excluded.value,
      updated_at = now();

  raise notice 'Demo data Pentol Surya selesai. Tenant %, owner %, employee sample count %.',
    v_tenant_id,
    v_owner_id,
    coalesce(array_length(v_employee_ids, 1), 0);
end $$;
