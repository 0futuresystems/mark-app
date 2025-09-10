'use client'

import { createContext, useContext, useState, useCallback } from 'react'
import Toast from '@/src/components/Toast'

interface ToastState {
  message: string
  type: 'success' | 'error'
  id: number
}

interface ToastContextType {
  showToast: (message: string, type: 'success' | 'error') => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastState[]>([])

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    // Check if message already exists in toasts array
    setToasts(prev => {
      const messageExists = prev.some(toast => toast.message === message && toast.type === type)
      if (messageExists) {
        return prev // Don't add duplicate message
      }
      
      const id = Date.now() + Math.random()
      return [...prev, { message, type, id }]
    })
  }, [])

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
