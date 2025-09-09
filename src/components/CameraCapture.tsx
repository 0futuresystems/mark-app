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

  const isSecure = typeof window !== 'undefined' && window.isSecureContext;
  const canMulti = isSecure && !!navigator.mediaDevices?.getUserMedia;

  function openLibrary() { libInputRef.current?.click(); }
  function onLibChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length) onFiles(files);
    e.currentTarget.value = '';
  }

  return (
    <div className="space-y-3">
      {/* Multi-shot (HTTPS only) */}
      {canMulti && (
        <button 
          className="w-full py-3 px-4 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2" 
          onClick={() => setShowCam(true)}
        >
          <Camera className="w-5 h-5" />
          <span>Take Photos</span>
        </button>
      )}

      {/* Library multi-select */}
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