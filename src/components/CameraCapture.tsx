'use client';

import { useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Camera, FolderOpen } from 'lucide-react';
import { cameraEnv } from '@/lib/cameraEnv';

const MultiShotCamera = dynamic(() => import('./MultiShotCamera'), { ssr: false });

interface CameraCaptureProps {
  onFiles: (files: File[]) => void;
}

export default function CameraCapture({ onFiles }: CameraCaptureProps) {
  const libInputRef = useRef<HTMLInputElement>(null);
  const [showCam, setShowCam] = useState(false);

  const env = cameraEnv();
  console.log('[cameraEnv]', env); // keep during dev

  function openLibrary() { libInputRef.current?.click(); }
  function onLibChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length) onFiles(files);
    e.currentTarget.value = '';
  }

  return (
    <div className="space-y-3">
      {/* Multi-shot camera button */}
      {env.canUseCamera ? (
        <button 
          className="w-full py-3 px-4 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2" 
          onClick={() => setShowCam(true)}
        >
          <Camera className="w-5 h-5" />
          <span>Take Photos</span>
        </button>
      ) : (
        <div className="text-sm opacity-80 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          Camera needs HTTPS. In dev you can set <code className="bg-yellow-100 px-1 rounded">NEXT_PUBLIC_ALLOW_INSECURE_CAMERA=1</code> and restart, or use an HTTPS tunnel (ngrok / Cloudflare Tunnel).
          <button 
            type="button" 
            onClick={openLibrary} 
            className="underline ml-2 text-blue-600 hover:text-blue-800"
          >
            Use file picker instead
          </button>
        </div>
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
          isOpen={showCam}
          onDone={(files) => { setShowCam(false); if (files.length) onFiles(files); }}
          onCancel={() => setShowCam(false)}
        />
      )}
    </div>
  );
}