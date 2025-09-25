/* eslint-disable @next/next/no-img-element */
'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Flashlight, RefreshCcw, Check, X } from 'lucide-react';
import { cameraEnv } from '@/lib/cameraEnv';
import { processImage } from '@/lib/files';
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
  isOpen = true, onDone, onCancel, jpegQuality = 0.95, maxWidth = 2560,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [shots, setShots] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(false);
  const [usingEnv, setUsingEnv] = useState(true);
  const [torchOn, setTorchOn] = useState(false);
  const [isCapturingNative, setIsCapturingNative] = useState(false);

  const env = cameraEnv();
  
  // iOS detection
  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
  
  // Hidden file input ref for native capture
  const nativeInputRef = useRef<HTMLInputElement>(null);
  
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
    const facingMode = usingEnv ? 'environment' : 'user';
    
    // Progressive constraints - try highest quality first, fall back gracefully
    const constraintSets: MediaStreamConstraints[] = [
      {
        video: {
          facingMode: { exact: facingMode },
          width: { exact: 1920 },
          height: { exact: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: false
      },
      {
        video: {
          facingMode: { exact: facingMode },
          width: { exact: 1280 },
          height: { exact: 720 },
          frameRate: { ideal: 30 }
        },
        audio: false
      },
      {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      },
      {
        video: {
          facingMode: { ideal: facingMode }
        },
        audio: false
      }
    ];

    // Try each constraint set in order
    for (let i = 0; i < constraintSets.length; i++) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraintSets[i]);
        const track = stream.getVideoTracks()[0];
        const settings = track.getSettings();
        return stream;
      } catch (error) {
        if (i === constraintSets.length - 1) {
          throw error; // Re-throw the last error if all attempts fail
        }
      }
    }
    
    throw new Error('All camera constraint attempts failed');
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

  async function captureFromVideo() {
    if (!videoRef.current) return;
    
    // iOS-style feedback for video capture
    navigator.vibrate?.(10);
    setFlash(true);
    setTimeout(() => setFlash(false), 140);

    const v = videoRef.current;
    const { videoWidth, videoHeight } = v;
    if (!videoWidth || !videoHeight) return;
    await waitForFrame(v);

    // Calculate target dimensions - cap long edge at maxWidth, preserve aspect ratio
    const longEdge = Math.max(videoWidth, videoHeight);
    const scale = Math.min(1, maxWidth / longEdge); // Don't upscale
    const targetWidth = Math.round(videoWidth * scale);
    const targetHeight = Math.round(videoHeight * scale);

    // Create canvas with proper dimensions
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    // Set canvas size to target resolution (not CSS scaling)
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    
    // Enable high-quality image smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Draw the video frame
    ctx.drawImage(v, 0, 0, targetWidth, targetHeight);

    const blob: Blob = await new Promise(res => canvas.toBlob(b => res(b!), 'image/jpeg', jpegQuality));
    const file = new File([blob], `shot-${Date.now()}.jpg`, { type: 'image/jpeg' });
    
    // Apply the same high-quality processing as native capture
    const processedFile = await processImage(file, {
      maxLongEdge: 2560,
      quality: 0.95,
      skipIfAlreadyProcessed: false, // Ensure consistent processing
      handleEXIF: true
    });
    
    setShots(prev => prev.concat(processedFile));
    
  }

  async function capture() {
    if (busy) return;
    setBusy(true);
    
    // Prioritize video stream capture for multi-shot workflow
    if (videoRef.current) {
      try {
        await captureFromVideo();
        return;
      } catch (error) {
        console.error('[Camera] Video capture failed, falling back to native:', error);
        // Fall through to native input as fallback
      }
    }
    
    // Fallback to native input only when video stream is unavailable or fails
    if (isIOS && nativeInputRef.current) {
      try {
        setIsCapturingNative(true);
        navigator.vibrate?.(10);
        setFlash(true);
        setTimeout(() => setFlash(false), 140);
        
        // Trigger native camera as fallback
        nativeInputRef.current.click();
        return; // The onNativeInputChange will handle the rest
      } catch (error) {
        console.error('[Camera] Native input fallback failed:', error);
        setIsCapturingNative(false);
      }
    }
    
    setBusy(false);
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

  // Handle native file input for high-res iOS capture
  const onNativeInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    
    try {
      // If no files selected (user canceled), fall back to video capture
      if (!files || files.length === 0) {
        setIsCapturingNative(false);
        
        // Fall back to video frame capture
        await captureFromVideo();
        return;
      }

      const file = files[0];
      
      // Use processImage with EXIF handling for single-pass processing
      let processedFile = await processImage(file, {
        maxLongEdge: 2560,
        quality: 0.95,
        skipIfAlreadyProcessed: false, // Always process native captures
        handleEXIF: true
      });
      
      setShots(prev => prev.concat(processedFile));
    } catch (error) {
      console.error('[Camera] Error processing native capture:', error);
      setIsCapturingNative(false);
      
      // On error, try video fallback
      try {
        await captureFromVideo();
      } catch (fallbackError) {
        console.error('[Camera] Video fallback also failed:', fallbackError);
        setBusy(false);
      }
    } finally {
      setIsCapturingNative(false);
      setBusy(false);
      // Clear the input for next capture
      e.target.value = '';
    }
  };


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
          
          {/* Hidden native file input for iOS high-res capture */}
          <input
            ref={nativeInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={onNativeInputChange}
          />
          
          {/* Show capturing toast when using native input */}
          {isCapturingNative && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'rgba(0, 0, 0, 0.8)',
              color: 'white',
              padding: '12px 20px',
              borderRadius: '8px',
              fontSize: '14px',
              zIndex: 10000
            }}>
              Capturing high-quality photo…
            </div>
          )}
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
