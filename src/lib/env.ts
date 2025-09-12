import { z } from "zod";

let _serverEnv: z.infer<typeof serverSchema> | null = null;

// Server schema (runs only on server/route handlers)
const serverSchema = z.object({
  // Existing server vars you already had — keep them:
  R2_ENDPOINT: z.string().url().optional(),
  R2_BUCKET: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  NEXT_PUBLIC_APP_ORIGIN: z.string().url().optional(),
  EMAIL_ALLOWLIST: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // Add the Supabase public keys here so server code can read them safely:
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(10),
});

/**
 * Call this ONLY on the server (API routes, server components, middleware).
 * Lazily parses process.env once and caches.
 */
export function getServerEnv() {
  if (_serverEnv) return _serverEnv;
  _serverEnv = serverSchema.parse(process.env);
  return _serverEnv;
}

/**
 * Safe client accessor for NEXT_PUBLIC_* values.
 * Do NOT throw in production client — log a clear error instead.
 */
export function getClientEnvSafe() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  if (!url || !key) {
    if (process.env.NODE_ENV !== "production") {
      // In dev, fail fast to catch misconfig
      throw new Error(
        "[env] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
      );
    } else {
      // In prod, don't crash the bundle — surface a visible error later
      // (the Supabase client getter will throw with a clearer message)
      // eslint-disable-next-line no-console
      console.error("[env] Missing NEXT_PUBLIC_* Supabase variables in production");
    }
  }

  return {
    NEXT_PUBLIC_SUPABASE_URL: url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: key,
  };
}

// Legacy compatibility functions
export function getPublicEnv() {
  return getClientEnvSafe();
}

export function isPublicEnvConfigured(): boolean {
  try {
    const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = getClientEnvSafe();
    return !!(NEXT_PUBLIC_SUPABASE_URL && NEXT_PUBLIC_SUPABASE_ANON_KEY);
  } catch {
    return false;
  }
}
