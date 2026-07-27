import { requireSupabase } from '../core/supabaseClient.js';
import { store } from '../core/store.js';

export const employeeRepository = {
  async loadContext() {
    const cached = store.getState();
    if (cached.employee) {
      return { employee: cached.employee, assignments: cached.assignments || [] };
    }

    const client = requireSupabase();
    const profile = store.getState().profile;
    if (!profile) return null;

    const { data: employee, error } = await client
      .from('employees')
      .select('*, default_outlet:outlets(*)')
      .eq('user_id', profile.id)
      .maybeSingle();
    if (error) throw error;

    const { data: assignments, error: assignmentError } = await client
      .from('outlet_assignments')
      .select('*, outlets(*)')
      .eq('employee_id', employee?.id || '00000000-0000-0000-0000-000000000000')
      .eq('active', true);
    if (assignmentError) throw assignmentError;

    store.setState({ employee, assignments: assignments || [] });
    return { employee, assignments: assignments || [] };
  },

  async listEmployees() {
    const client = requireSupabase();
    const { data, error } = await client
      .from('employees')
      .select('*, user_profiles(full_name, role, active)')
      .order('employee_code');
    if (error) throw error;
    return data || [];
  },
};
