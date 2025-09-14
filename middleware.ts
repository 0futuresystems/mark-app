import { NextRequest, NextResponse } from "next/server";

const PROTECTED = [/^\/api\/(sign-get|sign-put|export\/csv|email)/];

// PWA assets that should be accessible without authentication
const PWA_ASSETS = [
  '/manifest.json',
  '/sw.js',
  '/~offline',
  '/icons/',
  '/_next/static/',
  '/fallback.json',
  '/fallback.webp',
  '/fallback-ce627215c0e4a9af.js'
];

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  
  // Allow PWA assets without authentication
  if (PWA_ASSETS.some(asset => pathname.startsWith(asset))) {
    return NextResponse.next();
  }
  
  // Check protected API routes
  if (!PROTECTED.some(rx => rx.test(pathname))) return NextResponse.next();

  // Origin / CSRF-style guard
  const origin = req.headers.get("origin");
  const appOrigin = process.env.NEXT_PUBLIC_APP_ORIGIN;
  
  // Allow if no APP_ORIGIN is set (development) or if origin matches
  if (appOrigin && (!origin || origin !== appOrigin)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.next(); // per-route handlers will check user session
}

export const config = { 
  matcher: [
    "/api/:path*",
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|~offline|icons/|fallback).*)"
  ] 
};
