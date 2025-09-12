import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function ensureAuthed() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (k) => cookieStore.get(k)?.value } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  return user;
}
