import { createClient } from '@supabase/supabase-js';

const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const restUrl = typeof window !== 'undefined'
  ? `${window.location.origin}/_supabase`
  : envUrl;

export const supabase = createClient(restUrl, supabaseAnonKey);

export const supabaseRealtime = createClient(envUrl, supabaseAnonKey);

export function storageProxyUrl(url) {
  if (!url || typeof url !== 'string') return url;
  if (typeof window === 'undefined' || !envUrl) return url;
  if (!url.startsWith(envUrl)) return url;
  return window.location.origin + '/_supabase' + url.substring(envUrl.length);
}
