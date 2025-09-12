import { createClient } from '@supabase/supabase-js'
import { getClientEnvSafe } from './env'

let _supabase: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (_supabase) return _supabase;

  const { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: anon } = getClientEnvSafe();

  if (!url || !anon) {
    const msg = '[supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Check Vercel envs and redeploy.';
    // eslint-disable-next-line no-console
    console.error(msg);
    // Throw on actual usage so pages can render but features stop with a clear message
    throw new Error(msg);
  }

  _supabase = createClient(url, anon);
  return _supabase;
}

// Legacy export for backward compatibility - lazy getter
export const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(target, prop) {
    const client = getSupabaseClient();
    return (client as any)[prop];
  }
});

// Export a function to check if Supabase is properly configured
export function isSupabaseConfigured(): boolean {
  try {
    const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = getClientEnvSafe();
    return !!(NEXT_PUBLIC_SUPABASE_URL && NEXT_PUBLIC_SUPABASE_ANON_KEY);
  } catch {
    return false;
  }
}
