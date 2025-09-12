// src/lib/cameraEnv.ts
export function cameraEnv() {
  const isBrowser = typeof window !== 'undefined';
  const nodeEnv = process.env.NODE_ENV;
  // Explicit dev bypass (must be NEXT_PUBLIC so it's available client-side)
  const allowInsecure = process.env.NEXT_PUBLIC_ALLOW_INSECURE_CAMERA === '1';
  const isDev = nodeEnv === 'development';
  const isSecure = isBrowser ? (window.isSecureContext || (isDev && allowInsecure)) : false;

  const hasAPIs =
    isBrowser &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function';

  const canUseCamera = isSecure && hasAPIs;

  return { isBrowser, nodeEnv, isDev, allowInsecure, isSecure, hasAPIs, canUseCamera };
}
