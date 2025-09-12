import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const env = getServerEnv();
    return NextResponse.json({
      supabaseUrlSet: Boolean(env.NEXT_PUBLIC_SUPABASE_URL),
      supabaseKeySet: Boolean(env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "env error" }, { status: 500 });
  }
}
