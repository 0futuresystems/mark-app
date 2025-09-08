'use client';

import { useEffect, useRef, useState } from 'react';

type Props = {
  onDone: (files: File[]) => void;
  onCancel: () => void;
  jpegQuality?: number;   // 0..1
  maxWidth?: number;      // downscale width
};

export default function MultiShotCamera({
  onDone, onCancel, jpegQuality = 0.85, maxWidth = 1600,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [shots, setShots] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // HTTPS required on iOS
        if (typeof window !== 'undefined' && !window.isSecureContext) {
          throw new Error('Open this app over HTTPS (ngrok / Cloudflare Tunnel / deploy) to use the camera.');
        }
        const stream = await openVideoStream();
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;

        const v = videoRef.current!;
        v.srcObject = stream;
        v.setAttribute('playsinline', '');
        v.setAttribute('autoplay', '');
        v.muted = true;

        // Wait for metadata, then a playable frame (fixes iOS "black video")
        await once(v, 'loadedmetadata');
        try { await v.play(); } catch { /* iOS may delay play, fallback below */ }
        await waitForFrame(v);
      } catch (e: any) {
        setError(e?.message || 'Unable to access camera. Allow Camera in iOS Settings > Safari > Camera.');
      }
    })();

    const vis = () => {
      if (document.visibilityState !== 'visible') {
        streamRef.current?.getTracks().forEach(t => t.stop());
      }
    };
    document.addEventListener('visibilitychange', vis);

    return () => {
      document.removeEventListener('visibilitychange', vis);
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      cancelled = true;
    };
  }, []);

  async function openVideoStream(): Promise<MediaStream> {
    const rear: MediaStreamConstraints = { video: { facingMode: { ideal: 'environment' } }, audio: false };
    const anyCam: MediaStreamConstraints = { video: true, audio: false };
    try { return await navigator.mediaDevices.getUserMedia(rear); }
    catch { return await navigator.mediaDevices.getUserMedia(anyCam); }
  }

  function once(el: HTMLVideoElement, ev: keyof HTMLVideoElementEventMap) {
    return new Promise<void>(res => {
      const handler = () => { el.removeEventListener(ev, handler as any); res(); };
      el.addEventListener(ev, handler as any, { once: true });
    });
  }

  async function waitForFrame(v: HTMLVideoElement) {
    if ((v as any).requestVideoFrameCallback) {
      await new Promise<void>(res => (v as any).requestVideoFrameCallback(() => res()));
    } else {
      // fallback – give iOS time to produce a frame
      await new Promise(res => setTimeout(res, 120));
    }
  }

  async function capture() {
    if (!videoRef.current || busy) return;
    setBusy(true);
    try {
      const v = videoRef.current;
      const { videoWidth, videoHeight } = v;
      if (!videoWidth || !videoHeight) return;
      await waitForFrame(v);

      const scale = Math.min(1, maxWidth / videoWidth);
      const w = Math.round(videoWidth * scale);
      const h = Math.round(videoHeight * scale);

      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(v, 0, 0, w, h);

      const blob: Blob = await new Promise(res => canvas.toBlob(b => res(b!), 'image/jpeg', jpegQuality));
      const file = new File([blob], `shot-${Date.now()}.jpg`, { type: 'image/jpeg' });
      setShots(prev => prev.concat(file));
    } finally {
      setBusy(false);
    }
  }

  function removeShot(idx: number) {
    setShots(prev => prev.filter((_, i) => i !== idx));
  }

  // ---- Minimal, clean UI (no Tailwind) ----
  return (
    <div style={s.overlay}>
      <div style={s.sheet}>
        <div style={s.header}>
          <div style={s.title}>Camera (multi-shot)</div>
          <button style={s.ghostBtn} onClick={onCancel}>Close</button>
        </div>

        {error && <div style={s.error}>{error}</div>}

        <div style={s.videoWrap}>
          <video ref={videoRef} playsInline muted style={s.video} />
        </div>

        <div style={s.toolbar}>
          <button style={{...s.snapBtn, opacity: busy ? 0.6 : 1}} onClick={capture} disabled={busy}>
            {busy ? '…' : 'Snap'}
          </button>
          <button style={s.primaryBtn} onClick={() => onDone(shots)} disabled={!shots.length}>
            Done ({shots.length})
          </button>
          <button style={s.ghostBtn} onClick={onCancel}>Cancel</button>
        </div>

        {!!shots.length && (
          <div style={s.thumbRow}>
            {shots.map((f, i) => <Thumb key={i} file={f} onRemove={() => removeShot(i)} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function Thumb({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return (
    <div style={s.thumb}>
      <img src={url} alt="" style={s.thumbImg} />
      <button style={s.thumbX} onClick={onRemove} aria-label="Remove">×</button>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
    zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12
  },
  sheet: {
    width: '100%', maxWidth: 480, background: '#0e1117', color: '#fff',
    borderRadius: 16, boxShadow: '0 10px 30px rgba(0,0,0,0.4)'
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)'
  },
  title: { fontSize: 16, fontWeight: 600 },
  error: { color: '#fca5a5', fontSize: 13, padding: '8px 16px' },
  videoWrap: {
    position: 'relative', width: '100%', background: '#000', borderRadius: 12,
    overflow: 'hidden', margin: 16, aspectRatio: '3 / 4'
  },
  video: { width: '100%', height: '100%', objectFit: 'cover' },
  toolbar: {
    display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center',
    padding: '0 16px 16px'
  },
  primaryBtn: {
    padding: '10px 16px', borderRadius: 12, background: '#2563eb', color: '#fff',
    border: 'none', fontWeight: 600, fontSize: 14
  },
  ghostBtn: {
    padding: '8px 12px', borderRadius: 10, background: '#1f2937', color: '#fff',
    border: '1px solid rgba(255,255,255,0.08)', fontSize: 14
  },
  snapBtn: {
    width: 64, height: 64, borderRadius: 9999, background: '#fff', color: '#111', border: 'none',
    fontWeight: 700
  },
  thumbRow: { display: 'flex', gap: 8, overflowX: 'auto', padding: '0 16px 16px' },
  thumb: { position: 'relative', width: 84, height: 84, borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' },
  thumbImg: { width: '100%', height: '100%', objectFit: 'cover' },
  thumbX: {
    position: 'absolute', top: -8, right: -8, width: 24, height: 24, borderRadius: 9999,
    background: '#111', color: '#fff', border: '1px solid rgba(255,255,255,0.2)'
  }
};