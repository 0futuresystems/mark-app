// src/lib/permissions.ts
import { cameraEnv } from './cameraEnv';

export async function ensureCameraAccess(): Promise<void> {
  const env = cameraEnv();
  // For HTTP (not secure), skip probing; the file input will still open the camera UI.
  if (!env.canUseCamera) return;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach(t => t.stop());
  } catch {
    throw new Error('Camera permission denied. In Safari: Settings → Safari → Camera → Allow for this site, then reload.');
  }
}

export async function ensureMicAccess(): Promise<void> {
  const env = cameraEnv();
  // Microphone requires HTTPS on iOS
  if (!env.canUseCamera) {
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