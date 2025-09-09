/**
 * Safe environment variable handling that never throws at import time
 * All validation and error handling happens at runtime only
 */

export interface PublicEnv {
  NEXT_PUBLIC_SUPABASE_URL: string
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string
}

export interface ServerEnv {
  [key: string]: string | undefined
}

/**
 * Get public environment variables (safe for client-side use)
 * Never throws - returns empty strings for missing values
 */
export function getPublicEnv(): PublicEnv {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  }
}

/**
 * Get server-only environment variables with optional validation
 * Never throws at import time - only validates when called at runtime
 * 
 * @param requiredKeys - Array of environment variable keys that must be present in production
 * @returns Object with all server environment variables
 * @throws Only at runtime if required keys are missing in production
 */
export function getServerEnv(requiredKeys: string[] = []): ServerEnv {
  const env: ServerEnv = {}
  
  // Collect all environment variables (excluding public ones for security)
  for (const [key, value] of Object.entries(process.env)) {
    // Only include server-only variables (not NEXT_PUBLIC_*)
    if (!key.startsWith('NEXT_PUBLIC_')) {
      env[key] = value
    }
  }
  
  // Runtime validation for production
  if (process.env.NODE_ENV === 'production' && requiredKeys.length > 0) {
    const missingKeys: string[] = []
    
    for (const key of requiredKeys) {
      if (!env[key] || env[key]?.trim() === '') {
        missingKeys.push(key)
      }
    }
    
    if (missingKeys.length > 0) {
      throw new Error(
        `Missing required environment variables in production: ${missingKeys.join(', ')}`
      )
    }
  }
  
  return env
}

/**
 * Check if public environment variables are properly configured
 * Safe to call anywhere - never throws
 */
export function isPublicEnvConfigured(): boolean {
  const env = getPublicEnv()
  return !!(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

/**
 * Get a specific server environment variable safely
 * Returns undefined if not found, never throws
 */
export function getServerEnvVar(key: string): string | undefined {
  return process.env[key]
}

/**
 * Check if we're in a server environment
 */
export function isServer(): boolean {
  return typeof window === 'undefined'
}

/**
 * Check if we're in a client environment
 */
export function isClient(): boolean {
  return typeof window !== 'undefined'
}
