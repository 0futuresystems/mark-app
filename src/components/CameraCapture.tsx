'use client';

import { useRef, useState } from 'react';
import MultiShotCamera from './MultiShotCamera';
import { Camera, FolderOpen } from 'lucide-react';

interface CameraCaptureProps {
  onFiles: (files: File[]) => void;
}

export default function CameraCapture({ onFiles }: CameraCaptureProps) {
  const libInputRef = useRef<HTMLInputElement>(null);
  const [showCam, setShowCam] = useState(false);

  // Dev HTTPS gate
  const isDev = process.env.NODE_ENV === 'development';
  const allowInsecure = process.env.NEXT_PUBLIC_ALLOW_INSECURE_CAMERA === '1';
  const isSecure = (typeof window !== 'undefined' && window.isSecureContext) || (isDev && allowInsecure);
  const canMulti = isSecure && !!navigator.mediaDevices?.getUserMedia;

  function openLibrary() { libInputRef.current?.click(); }
  function onLibChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length) onFiles(files);
    e.currentTarget.value = '';
  }

  // Show insecure context message for dev
  if (!isSecure) {
    return (
      <div className="space-y-3">
        <div className="text-sm opacity-80 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          Camera needs HTTPS. In dev, set <code className="bg-yellow-100 px-1 rounded">NEXT_PUBLIC_ALLOW_INSECURE_CAMERA=1</code> or use ngrok/Cloudflare Tunnel.
        </div>
        
        {/* Fallback file picker */}
        <input
          ref={libInputRef}
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          onChange={onLibChange}
          style={{ display: 'none' }}
        />
        <button 
          className="w-full py-3 px-4 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors flex items-center justify-center space-x-2" 
          onClick={openLibrary}
        >
          <FolderOpen className="w-5 h-5" />
          <span>Use file picker instead</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Multi-shot camera button */}
      <button 
        className="w-full py-3 px-4 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2" 
        onClick={() => setShowCam(true)}
      >
        <Camera className="w-5 h-5" />
        <span>Take Photos</span>
      </button>

      {/* Fallback file picker for when camera isn't available */}
      {!canMulti && (
        <input
          ref={libInputRef}
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          onChange={onLibChange}
          style={{ display: 'none' }}
        />
      )}
      {!canMulti && (
        <button 
          className="w-full py-3 px-4 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors flex items-center justify-center space-x-2" 
          onClick={openLibrary}
        >
          <FolderOpen className="w-5 h-5" />
          <span>Use file picker instead</span>
        </button>
      )}

      {/* Library multi-select (always available) */}
      <input
        ref={libInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={onLibChange}
        style={{ display: 'none' }}
      />
      <button 
        className="w-full py-3 px-4 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors flex items-center justify-center space-x-2" 
        onClick={openLibrary}
      >
        <FolderOpen className="w-5 h-5" />
        <span>Choose from Library</span>
      </button>

      {showCam && (
        <MultiShotCamera
          onDone={(files) => { setShowCam(false); if (files.length) onFiles(files); }}
          onCancel={() => setShowCam(false)}
        />
      )}
    </div>
  );
}