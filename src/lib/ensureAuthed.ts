import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getServerEnv } from "./env";

export async function ensureAuthed() {
  const env = getServerEnv();
  const cookieStore = await cookies();

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {
          // no-op (Next will handle setting cookies in responses from server actions/route handlers)
        },
        remove() {
          // no-op
        },
      },
    }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    const e = new Error(`Unauthorized: ${error.message}`);
    // @ts-ignore add status for API handlers
    e.status = 401;
    throw e;
  }

  if (!user) {
    const e = new Error("Unauthorized");
    // @ts-ignore
    e.status = 401;
    throw e;
  }

  return user;
}
