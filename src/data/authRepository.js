import { requireSupabase, supabase } from '../core/supabaseClient.js';
import { appConfig } from '../core/config.js';
import { validatePin } from '../core/validators.js';

export const authRepository = {
  async getSession() {
    const client = requireSupabase();
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  onAuthStateChange(callback) {
    if (!supabase) return () => {};
    const { data } = supabase.auth.onAuthStateChange(callback);
    return () => data.subscription.unsubscribe();
  },

  async getCurrentProfile() {
    const client = requireSupabase();
    const { data, error } = await client
      .from('user_profiles')
      .select('*')
      .eq('id', (await client.auth.getUser()).data.user?.id)
      .single();

    if (error) throw error;
    return data;
  },

  async signInOwner({ email, password }) {
    const client = requireSupabase();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  async signInEmployee({ identifier, pin }) {
    const client = requireSupabase();
    if (!validatePin(pin)) throw new Error('PIN harus 6 digit.');

    const cleanIdentifier = String(identifier || '').trim();
    const { data, error } = await client.rpc('resolve_employee_login', {
      identifier_input: cleanIdentifier,
    });
    if (error) throw error;
    if (!data?.found) throw new Error('Kode karyawan atau nomor HP tidak ditemukan.');

    const credentials = data.email
      ? { email: data.email, password: pin }
      : { phone: data.phone, password: pin };

    const result = await client.auth.signInWithPassword(credentials);
    if (result.error) throw result.error;
    return result.data;
  },

  async updatePin({ currentPin, newPin }) {
    const client = requireSupabase();
    if (!validatePin(currentPin) || !validatePin(newPin)) {
      throw new Error('PIN lama dan PIN baru harus 6 digit.');
    }

    const profile = await this.getCurrentProfile();
    await this.signInEmployee({ identifier: profile.phone || profile.employee_code, pin: currentPin });
    const { data, error } = await client.auth.updateUser({ password: newPin });
    if (error) throw error;

    await client
      .from('user_profiles')
      .update({ pin_reset_required: false })
      .eq('id', profile.id);

    return data;
  },

  async resetEmployeePin({ userId, newPin }) {
    if (!validatePin(newPin)) throw new Error('PIN baru harus 6 digit.');
    return invokeAdminFunction('admin-reset-pin', { user_id: userId, new_pin: newPin });
  },

  async createEmployee(payload) {
    if (!validatePin(payload.pin)) throw new Error('PIN awal harus 6 digit.');
    return invokeAdminFunction('admin-create-employee', payload);
  },

  async signOut() {
    const client = requireSupabase();
    const { error } = await client.auth.signOut();
    if (error) throw error;
  },
};

async function invokeAdminFunction(functionName, body) {
  const client = requireSupabase();
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw sessionError;
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error('Sesi owner tidak aktif. Silakan login ulang.');

  let response;
  try {
    response = await fetch(`${appConfig.supabaseUrl}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        apikey: appConfig.supabasePublishableKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(`Edge Function ${functionName} belum bisa diakses. Upload frontend terbaru atau deploy function dengan --no-verify-jwt, lalu pastikan SERVICE_ROLE_KEY sudah diset.`);
  }

  const data = await readJson(response);
  if (!response.ok || data?.error) {
    throw new Error(functionErrorMessage(data, functionName));
  }
  return data;
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function functionErrorMessage(data, functionName) {
  const messages = {
    EMPLOYEE_CODE_EXISTS: 'Kode karyawan sudah dipakai.',
    PHONE_EXISTS: 'Nomor HP sudah dipakai.',
    INVALID_PAYLOAD: 'Data belum lengkap atau PIN bukan 6 digit.',
    UNAUTHORIZED: 'Sesi owner tidak valid. Silakan login ulang.',
    FORBIDDEN: 'Akun ini tidak punya akses owner/manager.',
    TARGET_NOT_FOUND: 'Karyawan tidak ditemukan.',
    METHOD_NOT_ALLOWED: 'Metode request Edge Function tidak valid.',
  };

  if (data?.error === 'INTERNAL_ERROR' && data?.message) {
    return `Edge Function ${functionName} error: ${data.message}`;
  }
  return messages[data?.error] || `Edge Function ${functionName} gagal diproses.`;
}
