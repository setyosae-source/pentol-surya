import { supabase } from './supabaseClient.js';
import { store } from './store.js';

let channel = null;
let tenantId = null;

export function initRealtime() {
  store.subscribe((state) => {
    if (!supabase || !state.profile || state.profile.role === 'employee') {
      stopRealtime();
      return;
    }

    if (tenantId === state.profile.tenant_id && channel) return;
    stopRealtime();
    tenantId = state.profile.tenant_id;

    channel = supabase.channel(`owner-dashboard-${tenantId}`);
    ['shifts', 'sales', 'location_pings', 'periodic_reports', 'final_reports', 'outlet_expenses', 'general_expenses']
      .forEach((table) => {
        channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table, filter: `tenant_id=eq.${tenantId}` },
          () => store.setState({ ownerDashboard: null }),
        );
      });

    channel.subscribe();
  });
}

function stopRealtime() {
  if (channel) supabase.removeChannel(channel);
  channel = null;
  tenantId = null;
}
