import { NextRequest, NextResponse } from "next/server";

const PROTECTED = [/^\/api\/(sign-get|sign-put|export\/csv|email)/];

export async function middleware(req: NextRequest) {
  if (!PROTECTED.some(rx => rx.test(req.nextUrl.pathname))) return NextResponse.next();

  // Origin / CSRF-style guard
  const origin = req.headers.get("origin");
  const appOrigin = process.env.NEXT_PUBLIC_APP_ORIGIN;
  
  // Allow if no APP_ORIGIN is set (development) or if origin matches
  if (appOrigin && (!origin || origin !== appOrigin)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.next(); // per-route handlers will check user session
}

export const config = { matcher: ["/api/:path*"] };
