import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (request.method !== 'POST') {
      return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
    }

    const supabaseUrl = requiredEnv('SUPABASE_URL');
    const publishableKey = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    const authorization = request.headers.get('Authorization');

    if (!publishableKey || !authorization) {
      return json({ error: 'UNAUTHORIZED' }, 401);
    }

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

    const { user_id, new_pin } = await request.json();
    if (!user_id || !/^\d{6}$/.test(String(new_pin))) {
      return json({ error: 'INVALID_PAYLOAD' }, 400);
    }

    const { data: target, error: targetError } = await serviceClient
      .from('user_profiles')
      .select('id, tenant_id, role')
      .eq('id', user_id)
      .single();

    if (targetError || !target || target.tenant_id !== caller.tenant_id) {
      return json({ error: 'TARGET_NOT_FOUND' }, 404);
    }

    const { error: updateError } = await serviceClient.auth.admin.updateUserById(user_id, {
      password: String(new_pin),
    });
    if (updateError) throw updateError;

    await serviceClient
      .from('user_profiles')
      .update({ pin_reset_required: true })
      .eq('id', user_id);

    return json({ ok: true });
  } catch (error) {
    console.error(error);
    return json({ error: 'INTERNAL_ERROR', message: error?.message ?? 'Unknown error' }, 500);
  }
});

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is required`);
  return value;
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
