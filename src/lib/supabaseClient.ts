import { createClient } from '@supabase/supabase-js'
import { getPublicEnv, isPublicEnvConfigured } from './env'

// Get environment variables safely (never throws at import time)
const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = getPublicEnv()

// Create client with fallback values to prevent crashes
// Validation will happen at runtime when actually used
export const supabase = createClient(
  NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'
)

// Export a function to check if Supabase is properly configured
export function isSupabaseConfigured(): boolean {
  return isPublicEnvConfigured()
}

// Export a function to get the actual configured client (throws if not configured)
export function getSupabaseClient() {
  if (!isPublicEnvConfigured()) {
    throw new Error('Supabase environment variables are not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.')
  }
  return supabase
}
