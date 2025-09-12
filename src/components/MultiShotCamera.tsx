/* eslint-disable @next/next/no-img-element */
'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, Flashlight, RefreshCcw, Check, X } from 'lucide-react';
import './camera/ios-camera.css';

// Type for experimental requestVideoFrameCallback (not yet in all browsers)
interface VideoFrameCallbackElement {
  requestVideoFrameCallback?: (callback: () => void) => void;
}

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
  const [flash, setFlash] = useState(false);
  const [usingEnv, setUsingEnv] = useState(true);
  const [torchOn, setTorchOn] = useState(false);

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
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Unable to access camera. Allow Camera in iOS Settings > Safari > Camera.');
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
  }, [usingEnv]);

  async function openVideoStream(): Promise<MediaStream> {
    const constraints: MediaStreamConstraints = {
      video: {
        facingMode: usingEnv ? { ideal: 'environment' } : 'user',
        width: { ideal: 1920 }, height: { ideal: 1080 }
      },
      audio: false
    };
    return await navigator.mediaDevices.getUserMedia(constraints);
  }

  function once(el: HTMLVideoElement, ev: keyof HTMLVideoElementEventMap) {
    return new Promise<void>(res => {
      const handler = () => { el.removeEventListener(ev, handler); res(); };
      el.addEventListener(ev, handler, { once: true });
    });
  }

  async function waitForFrame(v: HTMLVideoElement) {
    const extendedV = v as HTMLVideoElement & VideoFrameCallbackElement;
    if (extendedV.requestVideoFrameCallback) {
      await new Promise<void>(res => extendedV.requestVideoFrameCallback!(() => res()));
    } else {
      // fallback – give iOS time to produce a frame
      await new Promise<void>(res => setTimeout(res, 120));
    }
  }

  async function capture() {
    if (!videoRef.current || busy) return;
    setBusy(true);
    try {
      // iOS-style feedback
      navigator.vibrate?.(10);
      setFlash(true);
      setTimeout(() => setFlash(false), 140);

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

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks?.()[0];
    const caps: any = track?.getCapabilities?.();
    if (!track || !caps || !('torch' in caps)) return;
    const next = !torchOn;
    await track.applyConstraints({ advanced: [{ torch: next }] } as any).catch(()=>{});
    setTorchOn(next);
  };

  const flip = () => setUsingEnv(v => !v);

  if (error) {
    return (
      <div className="iosCam__overlay" role="dialog" aria-label="Camera">
        <div className="iosCam__topBar">
          <button className="iosCam__btn iosCam__btn--ghost" onClick={onCancel}><X size={20}/>Cancel</button>
          <div style={{opacity:.9}}>Camera</div>
          <div></div>
        </div>
        <div style={{flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fca5a5', fontSize: 16, textAlign: 'center', padding: '0 20px'}}>
          {error}
        </div>
      </div>
    );
  }

  const last = shots[shots.length - 1];

  return (
    <div className="iosCam__overlay" role="dialog" aria-label="Camera">
      <div className="iosCam__topBar">
        <button className="iosCam__btn iosCam__btn--ghost" onClick={onCancel}><X size={20}/>Cancel</button>
        <div style={{opacity:.9}}>Camera</div>
        <button className="iosCam__btn" onClick={() => onDone(shots)}><Check size={20}/>Done ({shots.length})</button>
      </div>

      <div className="iosCam__videoWrap">
        <video ref={videoRef} className="iosCam__video" muted playsInline />
        <div className="iosCam__grid" />
        <div className={`iosCam__flash ${flash ? 'iosCam__flash--show' : ''}`} />
      </div>

      <div className="iosCam__bottomBar">
        <button className="iosCam__thumb" onClick={() => onDone(shots)} aria-label="Review shots">
          {last ? <img src={URL.createObjectURL(last)} alt="" /> : <div style={{width:'100%',height:'100%'}}/>}
        </button>

        <div className="iosCam__spacer" />
        <button className="iosCam__shutterWrap" aria-label="Shutter" onClick={capture} disabled={busy}>
          <div className="iosCam__shutterRing" />
          <div className="iosCam__shutterCore" />
        </button>
        <div className="iosCam__spacer" />

        <div className="iosCam__controls">
          <button className="iosCam__btn iosCam__btn--ghost" onClick={flip} aria-label="Flip camera"><RefreshCcw size={20}/></button>
          <button className="iosCam__btn iosCam__btn--ghost" onClick={toggleTorch} aria-label="Torch"><Flashlight size={20}/></button>
        </div>
      </div>
    </div>
  );
}
