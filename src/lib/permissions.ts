// src/lib/permissions.ts
export async function ensureCameraAccess(): Promise<void> {
  // For HTTP (not secure), skip probing; the file input will still open the camera UI.
  if (typeof window !== 'undefined' && !window.isSecureContext) return;
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach(t => t.stop());
  } catch {
    throw new Error('Camera permission denied. In Safari: Settings → Safari → Camera → Allow for this site, then reload.');
  }
}

export async function ensureMicAccess(): Promise<void> {
  // Microphone requires HTTPS on iOS
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    throw new Error('Microphone requires a secure (HTTPS) URL. Use ngrok/Cloudflare Tunnel or a deployed URL.');
  }
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('Microphone API not available on this device/browser.');
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(t => t.stop());
  } catch {
    throw new Error('Microphone permission denied. In Safari: Settings → Safari → Microphone → Allow for this site, then reload.');
  }
}