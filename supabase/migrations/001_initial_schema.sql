-- Pentol Surya initial Supabase schema.
-- Run this file in Supabase SQL Editor or through Supabase CLI migrations.

create extension if not exists pgcrypto;

create type public.app_role as enum ('owner', 'manager', 'employee');
create type public.shift_status as enum ('draft', 'active', 'final_reported', 'closed', 'cancelled');
create type public.payment_method as enum ('cash', 'qris', 'transfer', 'piutang');
create type public.report_schedule_mode as enum ('free', 'scheduled');
create type public.stock_default_method as enum ('default_qty', 'previous_remaining');
create type public.payroll_status as enum ('draft', 'final', 'paid');
create type public.attendance_type as enum ('check_in', 'check_out');
create type public.audit_action as enum ('insert', 'update', 'delete');

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  active boolean not null default true,
  currency text not null default 'IDR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  role public.app_role not null,
  full_name text not null,
  phone text,
  employee_code text,
  active boolean not null default true,
  pin_reset_required boolean not null default false,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_profiles_phone_unique unique (tenant_id, phone),
  constraint user_profiles_employee_code_unique unique (tenant_id, employee_code)
);

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  user_id uuid not null unique references public.user_profiles(id) on delete cascade,
  employee_code text not null,
  phone text not null,
  default_outlet_id uuid,
  hourly_rate numeric(14,2) not null default 5000,
  meal_allowance numeric(14,2) not null default 10000,
  transport_allowance numeric(14,2) not null default 0,
  active boolean not null default true,
  hired_at date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employees_code_unique unique (tenant_id, employee_code),
  constraint employees_phone_unique unique (tenant_id, phone)
);

create table public.outlets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  name text not null,
  address text,
  pickup_lat numeric(10,7),
  pickup_lng numeric(10,7),
  sale_lat numeric(10,7),
  sale_lng numeric(10,7),
  checkout_lat numeric(10,7),
  checkout_lng numeric(10,7),
  geofence_radius_m integer not null default 120,
  report_schedule_mode public.report_schedule_mode not null default 'free',
  report_times time[] not null default '{}',
  stock_default_method public.stock_default_method not null default 'default_qty',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint outlets_radius_positive check (geofence_radius_m > 0)
);

alter table public.employees
  add constraint employees_default_outlet_id_fkey
  foreign key (default_outlet_id) references public.outlets(id) on delete set null;

create table public.outlet_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete cascade,
  outlet_id uuid not null references public.outlets(id) on delete cascade,
  starts_on date not null default current_date,
  ends_on date,
  locked_by_owner boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint outlet_assignments_window check (ends_on is null or ends_on >= starts_on)
);

create table public.product_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  name text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_categories_unique unique (tenant_id, name)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  category_id uuid references public.product_categories(id) on delete set null,
  name text not null,
  general_sale_price numeric(14,2) not null default 0,
  default_qty numeric(14,2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_unique unique (tenant_id, name),
  constraint products_prices_non_negative check (general_sale_price >= 0 and default_qty >= 0)
);

create table public.product_costs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete cascade,
  hpp numeric(14,2) not null default 0,
  valid_from timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_costs_unique unique (product_id, valid_from),
  constraint product_costs_hpp_non_negative check (hpp >= 0)
);

create table public.outlet_product_prices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  outlet_id uuid not null references public.outlets(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  sale_price numeric(14,2) not null,
  active boolean not null default true,
  valid_from timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint outlet_product_prices_unique unique (outlet_id, product_id, valid_from),
  constraint outlet_product_prices_non_negative check (sale_price >= 0)
);

create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete restrict,
  outlet_id uuid references public.outlets(id) on delete restrict,
  status public.shift_status not null default 'draft',
  checkin_at timestamptz,
  checkin_lat numeric(10,7),
  checkin_lng numeric(10,7),
  checkin_accuracy_m numeric(10,2),
  checkin_distance_m numeric(10,2),
  checkin_photo_path text,
  initial_report_submitted_at timestamptz,
  final_report_submitted_at timestamptz,
  checkout_at timestamptz,
  checkout_lat numeric(10,7),
  checkout_lng numeric(10,7),
  checkout_accuracy_m numeric(10,2),
  checkout_distance_m numeric(10,2),
  checkout_photo_path text,
  continue_shift boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index shifts_tenant_status_idx on public.shifts (tenant_id, status);
create index shifts_employee_created_idx on public.shifts (employee_id, created_at desc);

create table public.attendance_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  shift_id uuid not null references public.shifts(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  outlet_id uuid references public.outlets(id) on delete restrict,
  type public.attendance_type not null,
  lat numeric(10,7),
  lng numeric(10,7),
  accuracy_m numeric(10,2),
  distance_m numeric(10,2),
  photo_path text,
  inside_geofence boolean,
  created_at timestamptz not null default now()
);

create table public.initial_reports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  shift_id uuid not null unique references public.shifts(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  outlet_id uuid not null references public.outlets(id) on delete restrict,
  opening_cash numeric(14,2) not null default 0,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.initial_stock_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  initial_report_id uuid not null references public.initial_reports(id) on delete cascade,
  shift_id uuid not null references public.shifts(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  qty numeric(14,2) not null default 0,
  source text not null default 'default_qty',
  created_at timestamptz not null default now(),
  constraint initial_stock_items_unique unique (initial_report_id, product_id),
  constraint initial_stock_qty_non_negative check (qty >= 0)
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  shift_id uuid not null references public.shifts(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  outlet_id uuid not null references public.outlets(id) on delete restrict,
  payment_method public.payment_method not null,
  customer_name text,
  customer_phone text,
  total_amount numeric(14,2) not null default 0,
  note text,
  client_ref text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sales_tenant_date_idx on public.sales (tenant_id, occurred_at desc);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  sale_id uuid not null references public.sales(id) on delete cascade,
  shift_id uuid not null references public.shifts(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  qty numeric(14,2) not null,
  unit_price_snapshot numeric(14,2) not null,
  hpp_snapshot numeric(14,2) not null,
  subtotal numeric(14,2) generated always as (qty * unit_price_snapshot) stored,
  hpp_total numeric(14,2) generated always as (qty * hpp_snapshot) stored,
  created_at timestamptz not null default now(),
  constraint sale_items_qty_positive check (qty > 0),
  constraint sale_items_prices_non_negative check (unit_price_snapshot >= 0 and hpp_snapshot >= 0)
);

create table public.outlet_expenses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  shift_id uuid not null references public.shifts(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  outlet_id uuid not null references public.outlets(id) on delete restrict,
  category text not null,
  amount numeric(14,2) not null,
  note text,
  photo_path text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint outlet_expenses_amount_positive check (amount >= 0)
);

create table public.supplies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  shift_id uuid not null references public.shifts(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete set null,
  outlet_id uuid not null references public.outlets(id) on delete restrict,
  source_name text not null,
  source_role public.app_role,
  note text,
  supplied_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.supply_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  supply_id uuid not null references public.supplies(id) on delete cascade,
  shift_id uuid not null references public.shifts(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  qty numeric(14,2) not null,
  unit_hpp_snapshot numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  constraint supply_items_qty_positive check (qty > 0)
);

create table public.waste_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  shift_id uuid not null references public.shifts(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  outlet_id uuid not null references public.outlets(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  qty numeric(14,2) not null,
  reason text not null,
  unit_hpp_snapshot numeric(14,2) not null,
  hpp_total numeric(14,2) generated always as (qty * unit_hpp_snapshot) stored,
  photo_path text,
  wasted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint waste_items_qty_positive check (qty > 0)
);

create table public.periodic_reports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  shift_id uuid not null references public.shifts(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  outlet_id uuid not null references public.outlets(id) on delete restrict,
  cash_amount numeric(14,2) not null default 0,
  qris_amount numeric(14,2) not null default 0,
  transfer_amount numeric(14,2) not null default 0,
  note text,
  reported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.periodic_report_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  periodic_report_id uuid not null references public.periodic_reports(id) on delete cascade,
  shift_id uuid not null references public.shifts(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  physical_qty numeric(14,2) not null default 0,
  expected_qty numeric(14,2) not null default 0,
  variance_qty numeric(14,2) generated always as (physical_qty - expected_qty) stored,
  created_at timestamptz not null default now(),
  constraint periodic_report_qty_non_negative check (physical_qty >= 0)
);

create table public.final_reports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  shift_id uuid not null unique references public.shifts(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  outlet_id uuid not null references public.outlets(id) on delete restrict,
  cash_amount numeric(14,2) not null default 0,
  qris_amount numeric(14,2) not null default 0,
  transfer_amount numeric(14,2) not null default 0,
  receivable_amount numeric(14,2) not null default 0,
  cash_deposit_amount numeric(14,2) not null default 0,
  continue_shift boolean not null default false,
  note text,
  reported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.final_report_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  final_report_id uuid not null references public.final_reports(id) on delete cascade,
  shift_id uuid not null references public.shifts(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  ending_qty numeric(14,2) not null default 0,
  expected_qty numeric(14,2) not null default 0,
  sold_by_stock_qty numeric(14,2) generated always as (expected_qty - ending_qty) stored,
  created_at timestamptz not null default now(),
  constraint final_report_qty_non_negative check (ending_qty >= 0)
);

create table public.location_pings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  shift_id uuid not null references public.shifts(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  outlet_id uuid references public.outlets(id) on delete set null,
  lat numeric(10,7) not null,
  lng numeric(10,7) not null,
  accuracy_m numeric(10,2),
  distance_from_outlet_m numeric(10,2),
  inside_radius boolean,
  battery_percent integer,
  created_at timestamptz not null default now()
);

create index location_pings_shift_created_idx on public.location_pings (shift_id, created_at desc);

create table public.general_expenses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  category text not null,
  amount numeric(14,2) not null,
  note text,
  occurred_at date not null default current_date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint general_expenses_amount_positive check (amount >= 0)
);

create table public.cash_deposits (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  shift_id uuid references public.shifts(id) on delete set null,
  outlet_id uuid references public.outlets(id) on delete set null,
  employee_id uuid references public.employees(id) on delete set null,
  amount numeric(14,2) not null,
  received_by uuid references auth.users(id) on delete set null,
  note text,
  deposited_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cash_deposits_amount_positive check (amount >= 0)
);

create table public.payroll_periods (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  name text not null,
  starts_on date not null,
  ends_on date not null,
  status public.payroll_status not null default 'draft',
  created_by uuid references auth.users(id) on delete set null,
  finalized_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payroll_periods_window check (ends_on >= starts_on)
);

create table public.payroll_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  payroll_period_id uuid not null references public.payroll_periods(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  total_minutes integer not null default 0,
  hourly_rate numeric(14,2) not null default 0,
  wage_amount numeric(14,2) not null default 0,
  meal_allowance numeric(14,2) not null default 0,
  transport_allowance numeric(14,2) not null default 0,
  bonus_amount numeric(14,2) not null default 0,
  deduction_amount numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null default 0,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payroll_items_unique unique (payroll_period_id, employee_id)
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  tenant_id uuid references public.tenants(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  table_name text not null,
  record_id uuid,
  action public.audit_action not null,
  old_data jsonb,
  new_data jsonb,
  reason text,
  ip_address text,
  browser text,
  created_at timestamptz not null default now()
);

create table public.login_attempts (
  id bigint generated always as identity primary key,
  identifier text not null,
  ip_address text,
  success boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.app_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  key text not null,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_settings_unique unique (tenant_id, key)
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.request_header(header_name text)
returns text
language sql
stable
as $$
  select nullif(current_setting('request.headers', true)::jsonb ->> lower(header_name), '');
$$;

create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id
  from public.user_profiles
  where id = (select auth.uid())
    and active = true
  limit 1;
$$;

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.user_profiles
  where id = (select auth.uid())
    and active = true
  limit 1;
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() = 'owner', false);
$$;

create or replace function public.is_owner_or_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() in ('owner', 'manager'), false);
$$;

create or replace function public.current_employee_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.employees
  where user_id = (select auth.uid())
    and tenant_id = public.current_tenant_id()
    and active = true
  limit 1;
$$;

create or replace function public.can_employee_access_shift(target_shift_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.shifts s
    where s.id = target_shift_id
      and s.tenant_id = public.current_tenant_id()
      and s.employee_id = public.current_employee_id()
  );
$$;

create or replace function public.can_employee_edit_shift(target_shift_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.shifts s
    where s.id = target_shift_id
      and s.tenant_id = public.current_tenant_id()
      and s.employee_id = public.current_employee_id()
      and s.created_at >= date_trunc('day', now())
      and s.status in ('draft', 'active', 'final_reported')
      and not exists (
        select 1
        from public.shifts newer
        where newer.employee_id = public.current_employee_id()
          and newer.created_at > s.created_at
      )
  );
$$;

create or replace function public.haversine_m(lat1 numeric, lng1 numeric, lat2 numeric, lng2 numeric)
returns numeric
language sql
immutable
as $$
  select case
    when lat1 is null or lng1 is null or lat2 is null or lng2 is null then null
    else (
      6371000 * 2 * asin(
        sqrt(
          power(sin(radians((lat2 - lat1) / 2)), 2) +
          cos(radians(lat1)) * cos(radians(lat2)) *
          power(sin(radians((lng2 - lng1) / 2)), 2)
        )
      )
    )::numeric
  end;
$$;

create or replace function public.current_product_hpp(target_product_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select hpp
    from public.product_costs
    where product_id = target_product_id
      and tenant_id = public.current_tenant_id()
      and valid_from <= now()
    order by valid_from desc
    limit 1
  ), 0);
$$;

create or replace function public.fill_item_cost_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'sale_items' then
    new.hpp_snapshot := public.current_product_hpp(new.product_id);
  elsif tg_table_name = 'supply_items' then
    new.unit_hpp_snapshot := public.current_product_hpp(new.product_id);
  elsif tg_table_name = 'waste_items' then
    new.unit_hpp_snapshot := public.current_product_hpp(new.product_id);
  end if;
  return new;
end;
$$;

create or replace function public.resolve_employee_login(identifier_input text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  normalized text := lower(trim(identifier_input));
  clean_phone text := regexp_replace(coalesce(identifier_input, ''), '[^0-9+]', '', 'g');
  ip text := public.request_header('x-forwarded-for');
  attempts integer;
  found_phone text;
  found_email text;
begin
  if normalized is null or length(normalized) < 3 then
    raise exception 'INVALID_IDENTIFIER';
  end if;

  select count(*) into attempts
  from public.login_attempts
  where identifier = normalized
    and coalesce(ip_address, '') = coalesce(ip, '')
    and created_at > now() - interval '15 minutes';

  if attempts >= 10 then
    raise exception 'LOGIN_RATE_LIMITED';
  end if;

  insert into public.login_attempts(identifier, ip_address, success)
  values (normalized, ip, false);

  select coalesce(u.phone, p.phone), u.email
    into found_phone, found_email
  from public.user_profiles p
  join auth.users u on u.id = p.id
  where p.active = true
    and p.role = 'employee'
    and (
      lower(p.employee_code) = normalized
      or regexp_replace(coalesce(p.phone, ''), '[^0-9+]', '', 'g') = clean_phone
      or regexp_replace(coalesce(u.phone, ''), '[^0-9+]', '', 'g') = clean_phone
    )
  limit 1;

  if found_phone is null and found_email is null then
    return jsonb_build_object('found', false);
  end if;

  return jsonb_build_object(
    'found', true,
    'phone', found_phone,
    'email', found_email
  );
end;
$$;

create or replace function public.audit_row_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  row_tenant uuid;
  row_id uuid;
  action_name public.audit_action;
begin
  action_name := lower(tg_op)::public.audit_action;
  row_tenant := coalesce((to_jsonb(new) ->> 'tenant_id')::uuid, (to_jsonb(old) ->> 'tenant_id')::uuid);
  row_id := coalesce((to_jsonb(new) ->> 'id')::uuid, (to_jsonb(old) ->> 'id')::uuid);

  insert into public.audit_logs (
    tenant_id,
    actor_id,
    table_name,
    record_id,
    action,
    old_data,
    new_data,
    reason,
    ip_address,
    browser
  )
  values (
    row_tenant,
    (select auth.uid()),
    tg_table_name,
    row_id,
    action_name,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end,
    public.request_header('x-audit-reason'),
    public.request_header('x-forwarded-for'),
    public.request_header('user-agent')
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create or replace function public.recalculate_sale_total()
returns trigger
language plpgsql
as $$
declare
  target_sale uuid;
begin
  target_sale := coalesce(new.sale_id, old.sale_id);
  update public.sales
  set total_amount = coalesce((select sum(subtotal) from public.sale_items where sale_id = target_sale), 0),
      updated_at = now()
  where id = target_sale;
  return null;
end;
$$;

create or replace function public.dashboard_kpis(range_start timestamptz, range_end timestamptz)
returns jsonb
language sql
stable
security invoker
as $$
  with scope as (
    select public.current_tenant_id() as tenant_id
    where public.is_owner_or_manager()
  ),
  sales_scope as (
    select s.*
    from public.sales s, scope
    where s.tenant_id = scope.tenant_id
      and s.occurred_at >= range_start
      and s.occurred_at < range_end
  ),
  item_scope as (
    select si.*
    from public.sale_items si
    join sales_scope s on s.id = si.sale_id
  ),
  waste_scope as (
    select w.*
    from public.waste_items w, scope
    where w.tenant_id = scope.tenant_id
      and w.wasted_at >= range_start
      and w.wasted_at < range_end
  ),
  outlet_expense_scope as (
    select e.*
    from public.outlet_expenses e, scope
    where e.tenant_id = scope.tenant_id
      and e.occurred_at >= range_start
      and e.occurred_at < range_end
  ),
  general_expense_scope as (
    select e.*
    from public.general_expenses e, scope
    where e.tenant_id = scope.tenant_id
      and e.occurred_at >= range_start::date
      and e.occurred_at < range_end::date
  ),
  deposit_scope as (
    select d.amount
    from public.cash_deposits d, scope
    where d.tenant_id = scope.tenant_id
      and d.deposited_at >= range_start
      and d.deposited_at < range_end
    union all
    select fr.cash_deposit_amount as amount
    from public.final_reports fr, scope
    where fr.tenant_id = scope.tenant_id
      and fr.reported_at >= range_start
      and fr.reported_at < range_end
  ),
  payroll_scope as (
    select pi.*
    from public.payroll_items pi
    join public.payroll_periods pp on pp.id = pi.payroll_period_id
    join scope on scope.tenant_id = pi.tenant_id
    where pp.starts_on <= range_end::date
      and pp.ends_on >= range_start::date
  )
  select jsonb_build_object(
    'sales', coalesce((select sum(total_amount) from sales_scope), 0),
    'cash', coalesce((select sum(total_amount) from sales_scope where payment_method = 'cash'), 0),
    'qris', coalesce((select sum(total_amount) from sales_scope where payment_method = 'qris'), 0),
    'transfer', coalesce((select sum(total_amount) from sales_scope where payment_method = 'transfer'), 0),
    'piutang', coalesce((select sum(total_amount) from sales_scope where payment_method = 'piutang'), 0),
    'hpp', coalesce((select sum(hpp_total) from item_scope), 0),
    'waste_hpp', coalesce((select sum(hpp_total) from waste_scope), 0),
    'outlet_expenses', coalesce((select sum(amount) from outlet_expense_scope), 0),
    'general_expenses', coalesce((select sum(amount) from general_expense_scope), 0),
    'cash_deposits', coalesce((select sum(amount) from deposit_scope), 0),
    'payroll', coalesce((select sum(total_amount) from payroll_scope), 0),
    'cash_flow',
      coalesce((select sum(total_amount) from sales_scope where payment_method = 'cash'), 0)
      - coalesce((select sum(amount) from outlet_expense_scope), 0)
      - coalesce((select sum(amount) from general_expense_scope), 0)
      - coalesce((select sum(total_amount) from payroll_scope), 0),
    'estimated_profit',
      coalesce((select sum(total_amount) from sales_scope), 0)
      - coalesce((select sum(hpp_total) from item_scope), 0)
      - coalesce((select sum(hpp_total) from waste_scope), 0)
      - coalesce((select sum(amount) from outlet_expense_scope), 0)
      - coalesce((select sum(amount) from general_expense_scope), 0)
  );
$$;

create or replace function public.expected_stock_for_shift(target_shift_id uuid)
returns table(product_id uuid, expected_qty numeric)
language sql
stable
security definer
set search_path = public
as $$
  with allowed as (
    select s.id, s.tenant_id
    from public.shifts s
    where s.id = target_shift_id
      and s.tenant_id = public.current_tenant_id()
      and (public.is_owner_or_manager() or public.can_employee_access_shift(target_shift_id))
  ),
  opening as (
    select product_id, sum(qty) qty
    from public.initial_stock_items isi
    join allowed a on a.id = isi.shift_id
    group by product_id
  ),
  supplied as (
    select product_id, sum(qty) qty
    from public.supply_items si
    join allowed a on a.id = si.shift_id
    group by product_id
  ),
  sold as (
    select product_id, sum(qty) qty
    from public.sale_items sli
    join allowed a on a.id = sli.shift_id
    group by product_id
  ),
  wasted as (
    select product_id, sum(qty) qty
    from public.waste_items wi
    join allowed a on a.id = wi.shift_id
    group by product_id
  )
  select
    p.id as product_id,
    coalesce(o.qty, 0) + coalesce(su.qty, 0) - coalesce(so.qty, 0) - coalesce(w.qty, 0) as expected_qty
  from public.products p
  join allowed a on a.tenant_id = p.tenant_id
  left join opening o on o.product_id = p.id
  left join supplied su on su.product_id = p.id
  left join sold so on so.product_id = p.id
  left join wasted w on w.product_id = p.id
  where p.active = true
  order by p.name;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'tenants',
    'user_profiles',
    'employees',
    'outlets',
    'product_categories',
    'products',
    'product_costs',
    'outlet_product_prices',
    'shifts',
    'initial_reports',
    'sales',
    'outlet_expenses',
    'supplies',
    'waste_items',
    'periodic_reports',
    'final_reports',
    'general_expenses',
    'cash_deposits',
    'payroll_periods',
    'payroll_items',
    'app_settings'
  ] loop
    execute format(
      'create trigger %I_touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()',
      table_name,
      table_name
    );
  end loop;
end $$;

create trigger sale_items_recalculate_sale_total
after insert or update or delete on public.sale_items
for each row execute function public.recalculate_sale_total();

create trigger sale_items_fill_cost_snapshot
before insert or update on public.sale_items
for each row execute function public.fill_item_cost_snapshot();

create trigger supply_items_fill_cost_snapshot
before insert or update on public.supply_items
for each row execute function public.fill_item_cost_snapshot();

create trigger waste_items_fill_cost_snapshot
before insert or update on public.waste_items
for each row execute function public.fill_item_cost_snapshot();

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'user_profiles',
    'employees',
    'outlets',
    'outlet_assignments',
    'product_categories',
    'products',
    'product_costs',
    'outlet_product_prices',
    'shifts',
    'attendance_events',
    'initial_reports',
    'initial_stock_items',
    'sales',
    'sale_items',
    'outlet_expenses',
    'supplies',
    'supply_items',
    'waste_items',
    'periodic_reports',
    'periodic_report_items',
    'final_reports',
    'final_report_items',
    'location_pings',
    'general_expenses',
    'cash_deposits',
    'payroll_periods',
    'payroll_items',
    'app_settings'
  ] loop
    execute format(
      'create trigger %I_audit after insert or update or delete on public.%I for each row execute function public.audit_row_changes()',
      table_name,
      table_name
    );
  end loop;
end $$;

alter table public.tenants enable row level security;
alter table public.user_profiles enable row level security;
alter table public.employees enable row level security;
alter table public.outlets enable row level security;
alter table public.outlet_assignments enable row level security;
alter table public.product_categories enable row level security;
alter table public.products enable row level security;
alter table public.product_costs enable row level security;
alter table public.outlet_product_prices enable row level security;
alter table public.shifts enable row level security;
alter table public.attendance_events enable row level security;
alter table public.initial_reports enable row level security;
alter table public.initial_stock_items enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.outlet_expenses enable row level security;
alter table public.supplies enable row level security;
alter table public.supply_items enable row level security;
alter table public.waste_items enable row level security;
alter table public.periodic_reports enable row level security;
alter table public.periodic_report_items enable row level security;
alter table public.final_reports enable row level security;
alter table public.final_report_items enable row level security;
alter table public.location_pings enable row level security;
alter table public.general_expenses enable row level security;
alter table public.cash_deposits enable row level security;
alter table public.payroll_periods enable row level security;
alter table public.payroll_items enable row level security;
alter table public.audit_logs enable row level security;
alter table public.login_attempts enable row level security;
alter table public.app_settings enable row level security;

create policy "tenant users can read tenant"
on public.tenants for select
to authenticated
using (id = public.current_tenant_id());

create policy "owners can manage tenant"
on public.tenants for update
to authenticated
using (id = public.current_tenant_id() and public.is_owner())
with check (id = public.current_tenant_id() and public.is_owner());

create policy "profiles read self or managed tenant"
on public.user_profiles for select
to authenticated
using (
  id = (select auth.uid())
  or (tenant_id = public.current_tenant_id() and public.is_owner_or_manager())
);

create policy "owners managers insert profiles"
on public.user_profiles for insert
to authenticated
with check (tenant_id = public.current_tenant_id() and public.is_owner_or_manager());

create policy "owners managers update profiles"
on public.user_profiles for update
to authenticated
using (tenant_id = public.current_tenant_id() and public.is_owner_or_manager())
with check (tenant_id = public.current_tenant_id() and public.is_owner_or_manager());

create policy "employees read self or managers read tenant"
on public.employees for select
to authenticated
using (
  user_id = (select auth.uid())
  or (tenant_id = public.current_tenant_id() and public.is_owner_or_manager())
);

create policy "owners managers manage employees"
on public.employees for all
to authenticated
using (tenant_id = public.current_tenant_id() and public.is_owner_or_manager())
with check (tenant_id = public.current_tenant_id() and public.is_owner_or_manager());

create policy "tenant users read active outlets"
on public.outlets for select
to authenticated
using (tenant_id = public.current_tenant_id());

create policy "owners managers manage outlets"
on public.outlets for all
to authenticated
using (tenant_id = public.current_tenant_id() and public.is_owner_or_manager())
with check (tenant_id = public.current_tenant_id() and public.is_owner_or_manager());

create policy "tenant users read assignments"
on public.outlet_assignments for select
to authenticated
using (tenant_id = public.current_tenant_id());

create policy "owners managers manage assignments"
on public.outlet_assignments for all
to authenticated
using (tenant_id = public.current_tenant_id() and public.is_owner_or_manager())
with check (tenant_id = public.current_tenant_id() and public.is_owner_or_manager());

create policy "tenant users read categories"
on public.product_categories for select
to authenticated
using (tenant_id = public.current_tenant_id() and active = true);

create policy "owners managers manage categories"
on public.product_categories for all
to authenticated
using (tenant_id = public.current_tenant_id() and public.is_owner_or_manager())
with check (tenant_id = public.current_tenant_id() and public.is_owner_or_manager());

create policy "tenant users read active products"
on public.products for select
to authenticated
using (tenant_id = public.current_tenant_id() and active = true);

create policy "owners managers manage products"
on public.products for all
to authenticated
using (tenant_id = public.current_tenant_id() and public.is_owner_or_manager())
with check (tenant_id = public.current_tenant_id() and public.is_owner_or_manager());

create policy "owners managers access product costs"
on public.product_costs for all
to authenticated
using (tenant_id = public.current_tenant_id() and public.is_owner_or_manager())
with check (tenant_id = public.current_tenant_id() and public.is_owner_or_manager());

create policy "tenant users read active outlet prices"
on public.outlet_product_prices for select
to authenticated
using (tenant_id = public.current_tenant_id() and active = true);

create policy "owners managers manage outlet prices"
on public.outlet_product_prices for all
to authenticated
using (tenant_id = public.current_tenant_id() and public.is_owner_or_manager())
with check (tenant_id = public.current_tenant_id() and public.is_owner_or_manager());

create policy "shift select by tenant or own"
on public.shifts for select
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and (public.is_owner_or_manager() or employee_id = public.current_employee_id())
);

create policy "employees create own shift"
on public.shifts for insert
to authenticated
with check (
  tenant_id = public.current_tenant_id()
  and (public.is_owner_or_manager() or employee_id = public.current_employee_id())
);

create policy "today own shift edit or manager edit"
on public.shifts for update
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and (
    public.is_owner_or_manager()
    or (
      employee_id = public.current_employee_id()
      and created_at >= date_trunc('day', now())
      and not exists (
        select 1
        from public.shifts newer
        where newer.employee_id = public.current_employee_id()
          and newer.created_at > public.shifts.created_at
      )
    )
  )
)
with check (
  tenant_id = public.current_tenant_id()
  and (public.is_owner_or_manager() or employee_id = public.current_employee_id())
);

create policy "owners managers delete shifts"
on public.shifts for delete
to authenticated
using (tenant_id = public.current_tenant_id() and public.is_owner_or_manager());

create policy "attendance access"
on public.attendance_events for all
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and (public.is_owner_or_manager() or public.can_employee_access_shift(shift_id))
)
with check (
  tenant_id = public.current_tenant_id()
  and (public.is_owner_or_manager() or public.can_employee_edit_shift(shift_id))
);

create policy "initial reports access"
on public.initial_reports for all
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and (public.is_owner_or_manager() or public.can_employee_access_shift(shift_id))
)
with check (
  tenant_id = public.current_tenant_id()
  and (public.is_owner_or_manager() or public.can_employee_edit_shift(shift_id))
);

create policy "initial stock owner manager access"
on public.initial_stock_items for all
to authenticated
using (tenant_id = public.current_tenant_id() and public.is_owner_or_manager())
with check (tenant_id = public.current_tenant_id() and public.is_owner_or_manager());

create policy "initial stock employee insert own shift"
on public.initial_stock_items for insert
to authenticated
with check (
  tenant_id = public.current_tenant_id()
  and public.can_employee_edit_shift(shift_id)
  and exists (
    select 1 from public.products p
    where p.id = initial_stock_items.product_id
      and p.tenant_id = public.current_tenant_id()
  )
);

create policy "sales access"
on public.sales for all
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and (public.is_owner_or_manager() or public.can_employee_access_shift(shift_id))
)
with check (
  tenant_id = public.current_tenant_id()
  and (public.is_owner_or_manager() or public.can_employee_edit_shift(shift_id))
);

create policy "sale items owner manager access"
on public.sale_items for all
to authenticated
using (tenant_id = public.current_tenant_id() and public.is_owner_or_manager())
with check (tenant_id = public.current_tenant_id() and public.is_owner_or_manager());

create policy "sale items employee insert own shift"
on public.sale_items for insert
to authenticated
with check (
  tenant_id = public.current_tenant_id()
  and public.can_employee_edit_shift(shift_id)
  and exists (
    select 1
    from public.products p
    where p.id = sale_items.product_id
      and p.tenant_id = public.current_tenant_id()
  )
);

create policy "outlet expenses access"
on public.outlet_expenses for all
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and (public.is_owner_or_manager() or public.can_employee_access_shift(shift_id))
)
with check (
  tenant_id = public.current_tenant_id()
  and (public.is_owner_or_manager() or public.can_employee_edit_shift(shift_id))
);

create policy "supplies access"
on public.supplies for all
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and (public.is_owner_or_manager() or public.can_employee_access_shift(shift_id))
)
with check (
  tenant_id = public.current_tenant_id()
  and (public.is_owner_or_manager() or public.can_employee_edit_shift(shift_id))
);

create policy "supply items owner manager access"
on public.supply_items for all
to authenticated
using (tenant_id = public.current_tenant_id() and public.is_owner_or_manager())
with check (tenant_id = public.current_tenant_id() and public.is_owner_or_manager());

create policy "supply items employee insert own shift"
on public.supply_items for insert
to authenticated
with check (
  tenant_id = public.current_tenant_id()
  and public.can_employee_edit_shift(shift_id)
  and exists (
    select 1
    from public.products p
    where p.id = supply_items.product_id
      and p.tenant_id = public.current_tenant_id()
  )
);

create policy "waste owner manager access"
on public.waste_items for all
to authenticated
using (tenant_id = public.current_tenant_id() and public.is_owner_or_manager())
with check (tenant_id = public.current_tenant_id() and public.is_owner_or_manager());

create policy "waste employee insert own shift"
on public.waste_items for insert
to authenticated
with check (
  tenant_id = public.current_tenant_id()
  and employee_id = public.current_employee_id()
  and public.can_employee_edit_shift(shift_id)
  and exists (
    select 1
    from public.products p
    where p.id = waste_items.product_id
      and p.tenant_id = public.current_tenant_id()
  )
);

create policy "periodic reports access"
on public.periodic_reports for all
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and (public.is_owner_or_manager() or public.can_employee_access_shift(shift_id))
)
with check (
  tenant_id = public.current_tenant_id()
  and (public.is_owner_or_manager() or public.can_employee_edit_shift(shift_id))
);

create policy "periodic report items owner manager access"
on public.periodic_report_items for all
to authenticated
using (tenant_id = public.current_tenant_id() and public.is_owner_or_manager())
with check (tenant_id = public.current_tenant_id() and public.is_owner_or_manager());

create policy "periodic report items employee insert own shift"
on public.periodic_report_items for insert
to authenticated
with check (
  tenant_id = public.current_tenant_id()
  and public.can_employee_edit_shift(shift_id)
  and exists (
    select 1 from public.products p
    where p.id = periodic_report_items.product_id
      and p.tenant_id = public.current_tenant_id()
  )
);

create policy "final reports access"
on public.final_reports for all
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and (public.is_owner_or_manager() or public.can_employee_access_shift(shift_id))
)
with check (
  tenant_id = public.current_tenant_id()
  and (public.is_owner_or_manager() or public.can_employee_edit_shift(shift_id))
);

create policy "final report items owner manager access"
on public.final_report_items for all
to authenticated
using (tenant_id = public.current_tenant_id() and public.is_owner_or_manager())
with check (tenant_id = public.current_tenant_id() and public.is_owner_or_manager());

create policy "final report items employee insert own shift"
on public.final_report_items for insert
to authenticated
with check (
  tenant_id = public.current_tenant_id()
  and public.can_employee_edit_shift(shift_id)
  and exists (
    select 1 from public.products p
    where p.id = final_report_items.product_id
      and p.tenant_id = public.current_tenant_id()
  )
);

create policy "location access"
on public.location_pings for all
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and (public.is_owner_or_manager() or public.can_employee_access_shift(shift_id))
)
with check (
  tenant_id = public.current_tenant_id()
  and (public.is_owner_or_manager() or public.can_employee_edit_shift(shift_id))
);

create policy "owners managers manage general expenses"
on public.general_expenses for all
to authenticated
using (tenant_id = public.current_tenant_id() and public.is_owner_or_manager())
with check (tenant_id = public.current_tenant_id() and public.is_owner_or_manager());

create policy "owners managers manage cash deposits"
on public.cash_deposits for all
to authenticated
using (tenant_id = public.current_tenant_id() and public.is_owner_or_manager())
with check (tenant_id = public.current_tenant_id() and public.is_owner_or_manager());

create policy "payroll periods owner manager access"
on public.payroll_periods for all
to authenticated
using (tenant_id = public.current_tenant_id() and public.is_owner_or_manager())
with check (tenant_id = public.current_tenant_id() and public.is_owner_or_manager());

create policy "payroll items role access"
on public.payroll_items for select
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and (
    public.is_owner_or_manager()
    or employee_id = public.current_employee_id()
  )
);

create policy "payroll items owner manager write"
on public.payroll_items for all
to authenticated
using (tenant_id = public.current_tenant_id() and public.is_owner_or_manager())
with check (tenant_id = public.current_tenant_id() and public.is_owner_or_manager());

create policy "audit read by owner manager"
on public.audit_logs for select
to authenticated
using (tenant_id = public.current_tenant_id() and public.is_owner_or_manager());

create policy "login attempts locked"
on public.login_attempts for select
to authenticated
using (false);

create policy "settings tenant read"
on public.app_settings for select
to authenticated
using (tenant_id = public.current_tenant_id());

create policy "settings owner manager write"
on public.app_settings for all
to authenticated
using (tenant_id = public.current_tenant_id() and public.is_owner_or_manager())
with check (tenant_id = public.current_tenant_id() and public.is_owner_or_manager());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'shift-photos',
  'shift-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "shift photos select tenant"
on storage.objects for select
to authenticated
using (
  bucket_id = 'shift-photos'
  and (storage.foldername(name))[1] = public.current_tenant_id()::text
  and (
    public.is_owner_or_manager()
    or (
      (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
      and public.can_employee_access_shift(((storage.foldername(name))[2])::uuid)
    )
  )
);

create policy "shift photos insert tenant"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'shift-photos'
  and (storage.foldername(name))[1] = public.current_tenant_id()::text
  and (
    public.is_owner_or_manager()
    or (
      (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
      and public.can_employee_edit_shift(((storage.foldername(name))[2])::uuid)
    )
  )
);

create policy "shift photos update tenant"
on storage.objects for update
to authenticated
using (
  bucket_id = 'shift-photos'
  and (storage.foldername(name))[1] = public.current_tenant_id()::text
  and public.is_owner_or_manager()
)
with check (
  bucket_id = 'shift-photos'
  and (storage.foldername(name))[1] = public.current_tenant_id()::text
  and public.is_owner_or_manager()
);

revoke all on function public.resolve_employee_login(text) from public;
revoke all on function public.dashboard_kpis(timestamptz, timestamptz) from public;
revoke all on function public.expected_stock_for_shift(uuid) from public;
revoke all on function public.touch_updated_at() from public;
revoke all on function public.request_header(text) from public;
revoke all on function public.haversine_m(numeric, numeric, numeric, numeric) from public;
revoke all on function public.audit_row_changes() from public;
revoke all on function public.recalculate_sale_total() from public;
revoke all on function public.current_tenant_id() from public;
revoke all on function public.current_app_role() from public;
revoke all on function public.is_owner() from public;
revoke all on function public.is_owner_or_manager() from public;
revoke all on function public.current_employee_id() from public;
revoke all on function public.can_employee_access_shift(uuid) from public;
revoke all on function public.can_employee_edit_shift(uuid) from public;
revoke all on function public.current_product_hpp(uuid) from public;
revoke all on function public.fill_item_cost_snapshot() from public;
grant execute on function public.resolve_employee_login(text) to anon, authenticated;
grant execute on function public.dashboard_kpis(timestamptz, timestamptz) to authenticated;
grant execute on function public.expected_stock_for_shift(uuid) to authenticated;
grant execute on function public.current_tenant_id() to authenticated;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.is_owner() to authenticated;
grant execute on function public.is_owner_or_manager() to authenticated;
grant execute on function public.current_employee_id() to authenticated;
grant execute on function public.can_employee_access_shift(uuid) to authenticated;
grant execute on function public.can_employee_edit_shift(uuid) to authenticated;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

do $$
begin
  alter publication supabase_realtime add table
    public.shifts,
    public.sales,
    public.location_pings,
    public.periodic_reports,
    public.final_reports,
    public.outlet_expenses,
    public.general_expenses;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
