import { createClient } from '@supabase/supabase-js';

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

if (!serviceKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for server-side admin client');
}

export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
