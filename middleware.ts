import { NextRequest, NextResponse } from "next/server";
import { getServerEnv } from "./src/lib/env";

const PROTECTED = [/^\/api\/(sign-get|sign-put|export\/csv|email)/];

export async function middleware(req: NextRequest) {
  if (!PROTECTED.some(rx => rx.test(req.nextUrl.pathname))) return NextResponse.next();

  // Origin / CSRF-style guard
  const origin = req.headers.get("origin");
  const env = getServerEnv();
  
  // Allow if no APP_ORIGIN is set (development) or if origin matches
  if (env.NEXT_PUBLIC_APP_ORIGIN && (!origin || origin !== env.NEXT_PUBLIC_APP_ORIGIN)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.next(); // per-route handlers will check user session
}

export const config = { matcher: ["/api/:path*"] };
