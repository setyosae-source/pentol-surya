import { createClient } from '@supabase/supabase-js';
import { appConfig, isSupabaseConfigured } from './config.js';

export const supabase = isSupabaseConfigured()
  ? createClient(appConfig.supabaseUrl, appConfig.supabasePublishableKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
      global: {
        headers: {
          'x-application-name': 'pentol-surya-pwa',
        },
      },
    })
  : null;

export function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase belum dikonfigurasi. Isi .env terlebih dahulu.');
  }
  return supabase;
}
