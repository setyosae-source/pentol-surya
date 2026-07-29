import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, x-application-name, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (request.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);

    const supabaseUrl = requiredEnv('SUPABASE_URL');
    const publishableKey = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = requiredEnv('SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY');
    const authorization = request.headers.get('Authorization');
    if (!publishableKey || !authorization) return json({ error: 'UNAUTHORIZED' }, 401);

    const userClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authorization } },
    });
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return json({ error: 'UNAUTHORIZED' }, 401);

    const { data: caller, error: callerError } = await userClient
      .from('user_profiles')
      .select('id, tenant_id, role')
      .eq('id', authData.user.id)
      .single();

    if (callerError || !caller || !['owner', 'manager'].includes(caller.role)) {
      return json({ error: 'FORBIDDEN' }, 403);
    }

    const body = await request.json();
    const fullName = String(body.full_name || '').trim();
    const employeeCode = String(body.employee_code || '').trim();
    const phone = String(body.phone || '').trim();
    const pin = String(body.pin || '').trim();

    if (!fullName || !employeeCode || !phone || !/^\d{6}$/.test(pin)) {
      return json({ error: 'INVALID_PAYLOAD' }, 400);
    }

    const { data: existingCode, error: existingCodeError } = await serviceClient
      .from('user_profiles')
      .select('id')
      .eq('tenant_id', caller.tenant_id)
      .ilike('employee_code', employeeCode)
      .maybeSingle();
    if (existingCodeError) throw existingCodeError;
    if (existingCode) return json({ error: 'EMPLOYEE_CODE_EXISTS' }, 409);

    const { data: existingPhone, error: existingPhoneError } = await serviceClient
      .from('user_profiles')
      .select('id')
      .eq('tenant_id', caller.tenant_id)
      .eq('phone', phone)
      .maybeSingle();
    if (existingPhoneError) throw existingPhoneError;
    if (existingPhone) return json({ error: 'PHONE_EXISTS' }, 409);

    const internalEmail = `${emailPart(caller.tenant_id)}.${emailPart(employeeCode)}@employees.pentolsurya.app`;
    const { data: created, error: createError } = await serviceClient.auth.admin.createUser({
      email: internalEmail,
      password: pin,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        employee_code: employeeCode,
        phone,
      },
      app_metadata: {
        app_role: 'employee',
        tenant_id: caller.tenant_id,
      },
    });

    if (createError || !created.user) throw createError;

    const userId = created.user.id;
    const profilePayload = {
      id: userId,
      tenant_id: caller.tenant_id,
      role: 'employee',
      full_name: fullName,
      phone,
      employee_code: employeeCode,
      pin_reset_required: Boolean(body.pin_reset_required ?? true),
    };

    const { error: profileError } = await serviceClient.from('user_profiles').insert(profilePayload);
    if (profileError) {
      await serviceClient.auth.admin.deleteUser(userId);
      throw profileError;
    }

    const { data: employee, error: employeeError } = await serviceClient
      .from('employees')
      .insert({
        tenant_id: caller.tenant_id,
        user_id: userId,
        employee_code: employeeCode,
        phone,
        default_outlet_id: body.default_outlet_id || null,
        hourly_rate: Number(body.hourly_rate ?? 5000),
        meal_allowance: Number(body.meal_allowance ?? 10000),
        transport_allowance: Number(body.transport_allowance ?? 0),
      })
      .select()
      .single();

    if (employeeError) {
      await serviceClient.auth.admin.deleteUser(userId);
      throw employeeError;
    }

    return json({ ok: true, employee });
  } catch (error) {
    console.error(error);
    return json({ error: 'INTERNAL_ERROR', message: error?.message ?? 'Unknown error' }, 500);
  }
});

function requiredEnv(...names: string[]) {
  for (const name of names) {
    const value = Deno.env.get(name);
    if (value) return value;
  }
  throw new Error(`${names.join(' or ')} is required`);
}

function emailPart(value: string) {
  return String(value || 'employee')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'employee';
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}
