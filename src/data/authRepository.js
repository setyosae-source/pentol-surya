import { requireSupabase, supabase } from '../core/supabaseClient.js';
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
    const looksPhone = /^[+0-9][0-9\s-]{5,}$/.test(cleanIdentifier);
    let credentials = looksPhone ? { phone: cleanIdentifier, password: pin } : null;

    if (!credentials) {
      const { data, error } = await client.rpc('resolve_employee_login', {
        identifier_input: cleanIdentifier,
      });
      if (error) throw error;
      if (!data?.found) throw new Error('Kode karyawan tidak ditemukan.');
      credentials = data.email
        ? { email: data.email, password: pin }
        : { phone: data.phone, password: pin };
    }

    const { data, error } = await client.auth.signInWithPassword(credentials);
    if (error) throw error;
    return data;
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
    const client = requireSupabase();
    if (!validatePin(newPin)) throw new Error('PIN baru harus 6 digit.');
    const { data, error } = await client.functions.invoke('admin-reset-pin', {
      body: { user_id: userId, new_pin: newPin },
    });
    if (error) throw error;
    return data;
  },

  async createEmployee(payload) {
    const client = requireSupabase();
    if (!validatePin(payload.pin)) throw new Error('PIN awal harus 6 digit.');
    const { data, error } = await client.functions.invoke('admin-create-employee', {
      body: payload,
    });
    if (error) throw error;
    return data;
  },

  async signOut() {
    const client = requireSupabase();
    const { error } = await client.auth.signOut();
    if (error) throw error;
  },
};
