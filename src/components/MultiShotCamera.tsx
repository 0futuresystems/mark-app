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
        console.log(`[Camera] Constraint set ${i + 1} succeeded:`, settings.width + 'x' + settings.height, '@' + settings.frameRate + 'fps');
        return stream;
      } catch (error) {
        console.log(`[Camera] Constraint set ${i + 1} failed:`, error);
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
    
    console.log('[Camera] Video captured:', targetWidth + 'x' + targetHeight, 'quality:', jpegQuality, 'size:', file.size);
    setShots(prev => prev.concat(file));
    
    // Show fallback indicator briefly when using video capture on iOS
    if (isIOS) {
      const indicator = document.createElement('div');
      indicator.style.cssText = `
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.7); color: white; padding: 8px 16px;
        border-radius: 4px; font-size: 12px; z-index: 10001;
        pointer-events: none;
      `;
      indicator.textContent = 'Optimized quality (fallback)';
      document.body.appendChild(indicator);
      setTimeout(() => document.body.removeChild(indicator), 2000);
    }
  }

  async function capture() {
    if (!videoRef.current || busy) return;
    setBusy(true);
    
    // On iOS, prefer native file input for high-res capture
    if (isIOS && nativeInputRef.current) {
      try {
        setIsCapturingNative(true);
        navigator.vibrate?.(10);
        setFlash(true);
        setTimeout(() => setFlash(false), 140);
        
        // Trigger native camera
        nativeInputRef.current.click();
        return; // The onNativeInputChange will handle the rest
      } catch (error) {
        console.log('[Camera] Native input failed, falling back to video capture:', error);
        setIsCapturingNative(false);
        // Fall through to video capture
      }
    }
    
    try {
      await captureFromVideo();
    } finally {
      setBusy(false);
      setIsCapturingNative(false);
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

  // Handle native file input for high-res iOS capture
  const onNativeInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    
    try {
      // If no files selected (user canceled), fall back to video capture
      if (!files || files.length === 0) {
        console.log('[Camera] Native input canceled, falling back to video capture');
        setIsCapturingNative(false);
        
        // Fall back to video frame capture
        await captureFromVideo();
        return;
      }

      const file = files[0];
      console.log('[Camera] Native captured:', file.size, 'bytes, type:', file.type);
      
      // Handle EXIF orientation correction
      let processedFile = await handleEXIFOrientation(file);
      
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

  // Read EXIF orientation from JPEG file
  async function readEXIFOrientation(file: File): Promise<number> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const buffer = reader.result as ArrayBuffer;
        const view = new DataView(buffer);
        
        try {
          // Check JPEG markers
          if (view.getUint16(0) !== 0xFFD8) {
            resolve(1); // Not a JPEG, assume normal orientation
            return;
          }
          
          let offset = 2;
          let marker: number;
          let little = false;
          
          // Find EXIF marker (0xFFE1)
          while (offset < view.byteLength) {
            marker = view.getUint16(offset);
            if (marker === 0xFFE1) {
              offset += 4; // Skip marker and length
              // Check for "Exif\0\0"
              if (view.getUint32(offset) === 0x45786966 && view.getUint16(offset + 4) === 0x0000) {
                offset += 6;
                break;
              }
            }
            if ((marker & 0xFF00) !== 0xFF00) break;
            offset += 2 + view.getUint16(offset + 2);
          }
          
          if (offset >= view.byteLength) {
            resolve(1); // No EXIF found
            return;
          }
          
          // Check TIFF header for endianness
          const tiffHeaderOffset = offset;
          if (view.getUint16(offset) === 0x4949) {
            little = true;
          } else if (view.getUint16(offset) === 0x4D4D) {
            little = false;
          } else {
            resolve(1); // Invalid TIFF header
            return;
          }
          
          // Skip TIFF header (2 bytes endian + 2 bytes magic) and get first IFD offset
          offset += 4;
          const firstIfdRelativeOffset = little ? view.getUint32(offset, true) : view.getUint32(offset);
          const ifdOffset = tiffHeaderOffset + firstIfdRelativeOffset;
          
          // Read IFD entries
          const entries = little ? view.getUint16(ifdOffset, true) : view.getUint16(ifdOffset);
          
          for (let i = 0; i < entries; i++) {
            const entryOffset = ifdOffset + 2 + (i * 12);
            const tag = little ? view.getUint16(entryOffset, true) : view.getUint16(entryOffset);
            
            if (tag === 0x0112) { // Orientation tag
              const orientation = little ? view.getUint16(entryOffset + 8, true) : view.getUint16(entryOffset + 8);
              resolve(orientation);
              return;
            }
          }
          
          resolve(1); // Orientation tag not found, assume normal
        } catch (error) {
          console.log('[Camera] Error reading EXIF:', error);
          resolve(1); // Default to normal orientation
        }
      };
      
      reader.onerror = () => resolve(1);
      reader.readAsArrayBuffer(file.slice(0, 64 * 1024)); // Read first 64KB for EXIF
    });
  }

  // Handle EXIF orientation correction
  async function handleEXIFOrientation(file: File): Promise<File> {
    const orientation = await readEXIFOrientation(file);
    
    // If orientation is 1 (normal), no correction needed
    if (orientation === 1) {
      return file;
    }
    
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const { naturalWidth: width, naturalHeight: height } = img;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        
        // Apply transformation based on EXIF orientation
        switch (orientation) {
          case 2: // flip horizontal
            canvas.width = width;
            canvas.height = height;
            ctx.transform(-1, 0, 0, 1, width, 0);
            break;
          case 3: // 180 rotate left
            canvas.width = width;
            canvas.height = height;
            ctx.transform(-1, 0, 0, -1, width, height);
            break;
          case 4: // flip vertical
            canvas.width = width;
            canvas.height = height;
            ctx.transform(1, 0, 0, -1, 0, height);
            break;
          case 5: // flip vertical + 90 rotate right
            canvas.width = height;
            canvas.height = width;
            ctx.transform(0, 1, 1, 0, 0, 0);
            break;
          case 6: // 90 rotate right
            canvas.width = height;
            canvas.height = width;
            ctx.transform(0, 1, -1, 0, height, 0);
            break;
          case 7: // flip horizontal + 90 rotate right
            canvas.width = height;
            canvas.height = width;
            ctx.transform(0, -1, -1, 0, height, width);
            break;
          case 8: // 90 rotate left
            canvas.width = height;
            canvas.height = width;
            ctx.transform(0, -1, 1, 0, 0, width);
            break;
          default: // fallback to normal
            canvas.width = width;
            canvas.height = height;
            break;
        }
        
        ctx.drawImage(img, 0, 0);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const correctedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now()
            });
            console.log('[Camera] Applied EXIF orientation correction:', orientation);
            resolve(correctedFile);
          } else {
            // If blob creation fails, return original
            resolve(file);
          }
        }, 'image/jpeg', 0.95);
      };
      
      img.onerror = () => {
        // If image load fails, return original file
        resolve(file);
      };
      
      img.src = URL.createObjectURL(file);
    });
  }

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
