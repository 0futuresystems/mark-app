'use client'

import { ReactNode } from 'react'

interface AuthCardProps {
  children: ReactNode
  className?: string
}

export default function AuthCard({ children, className = '' }: AuthCardProps) {
  return (
    <div className={`w-full max-w-sm space-y-8 ${className}`}>
      {children}
    </div>
  )
}

interface AuthCardHeaderProps {
  title: string
  subtitle: string
}

export function AuthCardHeader({ title, subtitle }: AuthCardHeaderProps) {
  return (
    <div className="text-center">
      <h1 className="text-2xl font-bold text-foreground mb-2">
        {title}
      </h1>
      <p className="text-muted-foreground text-sm">
        {subtitle}
      </p>
    </div>
  )
}

interface AuthCardFormProps {
  children: ReactNode
  onSubmit: (e: React.FormEvent) => void
}

export function AuthCardForm({ children, onSubmit }: AuthCardFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {children}
    </form>
  )
}

interface AuthCardInputProps {
  id: string
  name: string
  type: string
  placeholder: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  disabled?: boolean
  required?: boolean
  autoComplete?: string
  inputMode?: "none" | "text" | "tel" | "url" | "email" | "numeric" | "decimal" | "search"
  pattern?: string
  maxLength?: number
  autoFocus?: boolean
  className?: string
}

export function AuthCardInput({
  id,
  name,
  type,
  placeholder,
  value,
  onChange,
  disabled = false,
  required = false,
  autoComplete,
  inputMode,
  pattern,
  maxLength,
  autoFocus = false,
  className = ''
}: AuthCardInputProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-foreground mb-2">
        {name === 'email' ? 'Email address' : '6-digit code'}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        className={`w-full px-4 py-4 text-lg bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary border border-border rounded-xl transition-all ${className}`}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        inputMode={inputMode}
        pattern={pattern}
        maxLength={maxLength}
        autoFocus={autoFocus}
      />
    </div>
  )
}

interface AuthCardButtonProps {
  type: 'submit' | 'button'
  disabled?: boolean
  loading?: boolean
  children: ReactNode
  onClick?: () => void
  className?: string
}

export function AuthCardButton({
  type,
  disabled = false,
  loading = false,
  children,
  onClick,
  className = ''
}: AuthCardButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`w-full flex items-center justify-center space-x-2 py-4 px-6 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed font-medium rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background ${className}`}
    >
      {children}
    </button>
  )
}

interface AuthCardFooterProps {
  children: ReactNode
}

export function AuthCardFooter({ children }: AuthCardFooterProps) {
  return (
    <div className="text-center">
      {children}
    </div>
  )
}
