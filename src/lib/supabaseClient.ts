"use client";

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getClientEnvSafe } from "./env";

let _supabase: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (_supabase) return _supabase;
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = getClientEnvSafe();

  if (!NEXT_PUBLIC_SUPABASE_URL || !NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("[supabase] Missing URL or ANON key");
  }

  _supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY);
  return _supabase;
}

// Optional legacy export to minimize refactors:
export const supabase = getSupabaseClient();

// Export a function to check if Supabase is properly configured
export function isSupabaseConfigured(): boolean {
  try {
    const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = getClientEnvSafe();
    return !!(NEXT_PUBLIC_SUPABASE_URL && NEXT_PUBLIC_SUPABASE_ANON_KEY);
  } catch {
    return false;
  }
}
