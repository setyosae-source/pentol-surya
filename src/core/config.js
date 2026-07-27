export const appConfig = Object.freeze({
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
  supabasePublishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
  sessionTimeoutMinutes: Number(import.meta.env.VITE_APP_SESSION_TIMEOUT_MINUTES || 480),
  locationPingMinutes: Number(import.meta.env.VITE_APP_LOCATION_PING_MINUTES || 15),
});

export function isSupabaseConfigured() {
  return Boolean(appConfig.supabaseUrl && appConfig.supabasePublishableKey);
}
