'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, X } from 'lucide-react';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, type, onClose, duration = 1200 }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 150); // Allow fade out animation
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 150);
  };

  return (
    <div
      className={`fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-150 ease-in-out ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
      role="alert"
      aria-live="polite"
    >
      <div
        className={`flex items-center space-x-3 px-4 py-3 rounded-lg shadow-lg border max-w-sm mx-4 ${
          type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}
      >
        {type === 'success' ? (
          <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
        ) : (
          <XCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
        )}
        <span className="text-sm font-medium">{message}</span>
        <button
          onClick={handleClose}
          className="ml-2 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
