'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, Square, RotateCcw, Trash2 } from 'lucide-react';
import { ensureMicAccess } from '../lib/permissions';
import { useSyncStore } from '../lib/sync/state';

interface AudioRecorderProps {
  onBlob: (file: File) => void;
}

type RecorderState = 'idle' | 'recording' | 'ready';

export default function AudioRecorder({ onBlob }: AudioRecorderProps) {
  const [state, setState] = useState<RecorderState>('idle');
  const [lastRecording, setLastRecording] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const { setMediaRecorderActive } = useSyncStore();

  const getSupportedMimeType = useCallback(() => {
    const types = ['audio/mp4', 'audio/webm'];
    
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    throw new Error('No supported audio format found');
  }, []);

  const startTimer = useCallback(() => {
    setRecordingTime(0);
    timerRef.current = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const cleanup = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setMediaRecorderActive(false);
    stopTimer();
  }, [stopTimer, setMediaRecorderActive]);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      
      // Check microphone permissions first
      await ensureMicAccess();
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mimeType = getSupportedMimeType();
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const file = new File([blob], `recording-${Date.now()}.${mimeType.split('/')[1]}`, {
          type: mimeType
        });
        
        setLastRecording(URL.createObjectURL(blob));
        setState('ready');
        onBlob(file);
        
        cleanup();
      };
      
      mediaRecorder.start();
      setState('recording');
      setMediaRecorderActive(true);
      startTimer();
    } catch (err) {
      cleanup();
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setError('Microphone access denied. Please allow microphone access in your browser settings.');
        } else if (err.name === 'NotFoundError') {
          setError('No microphone found. Please connect a microphone.');
        } else if (err.name === 'NotSupportedError') {
          setError('Audio recording not supported on this device.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Failed to access microphone. Please check your microphone permissions.');
      }
      setState('idle');
      console.error('Error starting recording:', err);
    }
  }, [getSupportedMimeType, onBlob, cleanup, startTimer]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && state === 'recording') {
      mediaRecorderRef.current.stop();
      setState('ready');
      setMediaRecorderActive(false);
    }
  }, [state, setMediaRecorderActive]);

  const retake = useCallback(() => {
    if (lastRecording) {
      URL.revokeObjectURL(lastRecording);
      setLastRecording(null);
      setState('idle');
    }
  }, [lastRecording]);

  useEffect(() => {
    return () => {
      cleanup();
      if (lastRecording) {
        URL.revokeObjectURL(lastRecording);
      }
    };
  }, [cleanup, lastRecording]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col space-y-3">
        {state === 'idle' && (
          <button 
            onClick={startRecording} 
            className="w-full py-3 px-4 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors flex items-center justify-center space-x-2"
          >
            <Mic className="w-5 h-5" />
            <span>Start Recording</span>
          </button>
        )}
        
        {state === 'recording' && (
          <div className="flex items-center space-x-4">
            <button 
              onClick={stopRecording} 
              className="py-3 px-4 bg-rose-600 text-white rounded-xl font-medium hover:bg-rose-700 transition-colors flex items-center justify-center space-x-2"
            >
              <Square className="w-5 h-5" />
              <span>Stop Recording</span>
            </button>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-rose-600 rounded-full animate-pulse"></div>
              <span className="text-lg font-medium text-gray-900">
                {formatTime(recordingTime)}
              </span>
            </div>
          </div>
        )}
        
        {state === 'ready' && (
          <div className="flex space-x-3">
            <button 
              onClick={startRecording} 
              className="flex-1 py-3 px-4 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors flex items-center justify-center space-x-2"
            >
              <RotateCcw className="w-5 h-5" />
              <span>Record Again</span>
            </button>
            <button 
              onClick={retake} 
              className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors flex items-center justify-center space-x-2"
            >
              <Trash2 className="w-5 h-5" />
              <span>Delete</span>
            </button>
          </div>
        )}
      </div>
      
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg">
          <p className="text-rose-700 text-sm">{error}</p>
        </div>
      )}
      
      {lastRecording && state === 'ready' && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
          <h4 className="text-sm font-medium text-emerald-800 mb-2">Recording Preview:</h4>
          <audio controls src={lastRecording} className="w-full" />
        </div>
      )}
    </div>
  );
}

