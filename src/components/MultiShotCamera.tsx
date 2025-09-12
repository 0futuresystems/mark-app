/* eslint-disable @next/next/no-img-element */
'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Flashlight, RefreshCcw, Check, X } from 'lucide-react';
import { cameraEnv } from '@/lib/cameraEnv';
import './camera/ios-camera.css';
import './camera/ios-camera-review.css';

// Type for experimental requestVideoFrameCallback (not yet in all browsers)
interface VideoFrameCallbackElement {
  requestVideoFrameCallback?: (callback: () => void) => void;
}

type Props = {
  isOpen?: boolean;
  onDone: (files: File[]) => void;
  onCancel: () => void;
  jpegQuality?: number;   // 0..1
  maxWidth?: number;      // downscale width
};

export default function MultiShotCamera({
  isOpen = true, onDone, onCancel, jpegQuality = 0.85, maxWidth = 1600,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [shots, setShots] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(false);
  const [usingEnv, setUsingEnv] = useState(true);
  const [torchOn, setTorchOn] = useState(false);

  const env = cameraEnv();
  
  // Review mode state
  const [mode, setMode] = useState<'capture'|'review'>('capture');
  const [activeIndex, setActiveIndex] = useState(0);
  
  // Review gesture state
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const gestureRef = useRef<{ lastTap: number; startX: number; startY: number; dragging: boolean; swipeDX: number; }>(
    { lastTap: 0, startX: 0, startY: 0, dragging: false, swipeDX: 0 }
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!env.canUseCamera) {
          setError('Camera requires HTTPS (or dev bypass).');
          return;
        }
        setError(null);
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
  }, [usingEnv, env.canUseCamera]);

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

  // Review mode functions
  const openReview = (index = Math.max(0, shots.length - 1)) => {
    if (!shots.length) return;
    setActiveIndex(index);
    setScale(1); 
    setTx(0); 
    setTy(0);
    setMode('review');
  };

  const closeReview = () => { 
    setMode('capture'); 
    setScale(1); 
    setTx(0); 
    setTy(0); 
  };

  const deleteCurrent = () => {
    setShots(prev => {
      const next = prev.slice();
      next.splice(activeIndex, 1);
      const nextIdx = Math.min(activeIndex, Math.max(0, next.length - 1));
      setActiveIndex(nextIdx);
      if (!next.length) setMode('capture');
      return next;
    });
  };

  const retake = () => { 
    deleteCurrent(); 
    setMode('capture'); 
  };

  // Review gesture handlers
  const onStageTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    gestureRef.current.startX = t.clientX;
    gestureRef.current.startY = t.clientY;
    gestureRef.current.dragging = true;
    gestureRef.current.swipeDX = 0;
  };

  const onStageTouchMove = (e: React.TouchEvent) => {
    if (!gestureRef.current.dragging) return;
    const t = e.touches[0];
    const dx = t.clientX - gestureRef.current.startX;
    const dy = t.clientY - gestureRef.current.startY;
    gestureRef.current.swipeDX = dx;
    if (scale > 1) { 
      setTx(tx + dx); 
      setTy(ty + dy); 
    }
    gestureRef.current.startX = t.clientX; 
    gestureRef.current.startY = t.clientY;
  };

  const onStageTouchEnd = () => {
    const { lastTap, swipeDX } = gestureRef.current;
    const now = Date.now();
    // double tap to toggle zoom
    if (now - lastTap < 260) {
      const nextScale = scale > 1 ? 1 : 2.5;
      setScale(nextScale); 
      if (nextScale === 1) { 
        setTx(0); 
        setTy(0); 
      }
    }
    gestureRef.current.lastTap = now;
    // swipe next/prev when not zoomed
    if (scale === 1 && Math.abs(swipeDX) > 60) {
      const dir = swipeDX < 0 ? 1 : -1;
      setActiveIndex(i => Math.max(0, Math.min(shots.length - 1, i + dir)));
    }
    gestureRef.current.dragging = false;
  };

  // Early return if not open
  if (!isOpen) return null;

  // Add one-time sanity log
  useEffect(() => { 
    if (isOpen) console.log('[Camera] mounted'); 
  }, [isOpen]);

  if (error) {
    const errorOverlay = (
      <div className="iosCam__overlay" role="dialog" aria-label="Camera" style={{ zIndex: 9999 }}>
        <div className="iosCam__topBar">
          <button className="iosCam__btn iosCam__btn--ghost" onClick={onCancel}><X size={20}/>Close</button>
          <div style={{opacity:.9}}>Camera</div>
          <div></div>
        </div>
        <div style={{flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fca5a5', fontSize: 16, textAlign: 'center', padding: '0 20px'}}>
          <div className="mb-4">
            <Camera size={48} className="opacity-50 mx-auto mb-4" />
            <p className="text-lg font-medium mb-2">{error}</p>
            <p className="text-sm opacity-75">
              Camera requires HTTPS. In dev set <code className="bg-yellow-100 px-1 rounded">NEXT_PUBLIC_ALLOW_INSECURE_CAMERA=1</code> and restart, or open over https:// via ngrok.
            </p>
          </div>
        </div>
      </div>
    );
    return typeof window !== 'undefined' ? createPortal(errorOverlay, document.body) : errorOverlay;
  }

  const last = shots[shots.length - 1];

  const overlay = (
    <>
      {mode === 'capture' && (
        <div className="iosCam__overlay" role="dialog" aria-label="Camera" style={{ zIndex: 9999 }}>
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
            <button className="iosCam__thumb" onClick={() => openReview()} aria-label="Review shots">
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
      )}

      {mode === 'review' && (
        <div className="iosCamReview__overlay" role="dialog" aria-label="Review photos">
          <div className="iosCamReview__topBar">
            <button className="iosCamReview__btn" onClick={closeReview}>Back</button>
            <div className="iosCamReview__counter">{activeIndex+1}/{shots.length}</div>
            <button className="iosCamReview__btn" onClick={deleteCurrent}>Trash</button>
          </div>

          <div
            className="iosCamReview__stage"
            onTouchStart={onStageTouchStart}
            onTouchMove={onStageTouchMove}
            onTouchEnd={onStageTouchEnd}
          >
            {shots[activeIndex] && (
              <img
                className="iosCamReview__img"
                src={URL.createObjectURL(shots[activeIndex])}
                alt=""
                style={{ transform: `translate3d(${tx}px, ${ty}px, 0) scale(${scale})` }}
              />
            )}
          </div>

          <div className="iosCamReview__bottomBar">
            <button className="iosCamReview__btn" onClick={retake}>Retake</button>
            <div style={{flex:1}} />
            <button className="iosCamReview__btn" onClick={() => onDone(shots)}>Done ({shots.length})</button>
          </div>
        </div>
      )}
    </>
  );

  return typeof window !== 'undefined' ? createPortal(overlay, document.body) : overlay;
}
