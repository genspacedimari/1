import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail loudly at boot rather than surfacing a confusing runtime error
  // later inside some unrelated Supabase call.
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Check your .env file.'
  );
}

/**
 * Single shared Supabase client for the whole app. The anon key is safe to
 * ship client-side by design — it only works within the bounds of the RLS
 * policies defined on each table (see database/supabase/*.sql).
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
