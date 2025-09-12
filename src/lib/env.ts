import { z } from "zod";

const server = z.object({
  R2_ENDPOINT: z.string().url(),
  R2_BUCKET: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(5),
  R2_SECRET_ACCESS_KEY: z.string().min(5),
  RESEND_API_KEY: z.string().min(5).optional(), // allow missing to run without email in dev
  EMAIL_FROM: z.string().email().optional(),
  NEXT_PUBLIC_APP_ORIGIN: z.string().url().optional(),
  EMAIL_ALLOWLIST: z.string().optional(), // comma-separated
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
});

const client = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(10),
});

// Lazy validation - only validate when accessed
let _serverEnv: z.infer<typeof server> | null = null;
let _clientEnv: z.infer<typeof client> | null = null;

export const env = {
  get server() {
    if (!_serverEnv) {
      _serverEnv = server.parse(process.env);
    }
    return _serverEnv;
  },
  get client() {
    if (!_clientEnv) {
      _clientEnv = client.parse(process.env);
    }
    return _clientEnv;
  },
};

/** Safe client env getter: warns instead of throwing to avoid blank screens */
export function getClientEnvSafe() {
  const parsed = client.safeParse(process.env);
  if (!parsed.success) {
    const msg = `[env] Missing NEXT_PUBLIC_*: ${parsed.error.issues.map(i => i.path.join('.') ).join(', ')}`;
    if (process.env.NODE_ENV === 'production') {
      // Warn but don't crash hydration; downstream code should check empties.
      // eslint-disable-next-line no-console
      console.error(msg);
      return {
        NEXT_PUBLIC_SUPABASE_URL: '',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: '',
      };
    } else {
      // In dev, be noisy to catch misconfig early
      throw new Error(msg);
    }
  }
  return parsed.data;
}

// Server env getters (lazy per-domain)
export function getR2Env() {
  return z.object({
    R2_ENDPOINT: z.string().url(),
    R2_BUCKET: z.string().min(1),
    R2_ACCESS_KEY_ID: z.string().min(5),
    R2_SECRET_ACCESS_KEY: z.string().min(5),
  }).parse(process.env);
}

export function getEmailEnv() {
  return z.object({
    RESEND_API_KEY: z.string().min(5),
    EMAIL_FROM: z.string().email(),
    EMAIL_ALLOWLIST: z.string().optional(),
  }).parse(process.env);
}

// Legacy compatibility functions
export function getPublicEnv() {
  return getClientEnvSafe();
}

export function getServerEnv() {
  return env.server;
}

export function isPublicEnvConfigured(): boolean {
  try {
    const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = getClientEnvSafe();
    return !!(NEXT_PUBLIC_SUPABASE_URL && NEXT_PUBLIC_SUPABASE_ANON_KEY);
  } catch {
    return false;
  }
}

export function getServerEnvVar(key: string): string | undefined {
  return (env.server as any)[key];
}

export function isServer(): boolean {
  return typeof window === 'undefined';
}

export function isClient(): boolean {
  return typeof window !== 'undefined';
}
