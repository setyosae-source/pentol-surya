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

  async listEmployees({ includeInactive = false } = {}) {
    const client = requireSupabase();
    let query = client
      .from('employees')
      .select('*, user_profiles(full_name, role, active), default_outlet:outlets(name)')
      .order('employee_code');

    if (!includeInactive) query = query.eq('active', true);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async updateEmployee(id, payload) {
    const client = requireSupabase();
    const { user_id, full_name, employee_code, phone, active, ...employeeFields } = payload;

    if (user_id) {
      const profileUpdate = cleanBlank({ full_name, employee_code, phone, active });
      if (Object.keys(profileUpdate).length) {
        const { error: profileError } = await client
          .from('user_profiles')
          .update(profileUpdate)
          .eq('id', user_id);
        if (profileError) throw profileError;
      }
    }

    const employeeUpdate = cleanBlank({
      ...employeeFields,
      employee_code,
      phone,
      active,
    });

    const { data, error } = await client
      .from('employees')
      .update(employeeUpdate)
      .eq('id', id)
      .select('*, user_profiles(full_name, role, active), default_outlet:outlets(name)')
      .single();
    if (error) throw error;
    return data;
  },

  async deactivateEmployee(employee) {
    return this.updateEmployee(employee.id, {
      user_id: employee.user_id,
      active: false,
    });
  },
};

function cleanBlank(record) {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== '' && value !== undefined),
  );
}
