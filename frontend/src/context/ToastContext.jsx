import React, { createContext, useContext } from 'react'
import { Toaster, toast as hotToast } from 'react-hot-toast'

/* ── Context ─────────────────────────────────────────────── */
const ToastContext = createContext(null)

/* ── Dark toast style config ─────────────────────────────── */
const toastOptions = {
  duration: 4000,
  style: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-dim)',
    color: 'var(--text-primary)',
    fontSize: '13px',
    fontFamily: "'Inter', system-ui, sans-serif",
    borderRadius: '10px',
    boxShadow: 'var(--shadow-md)',
    backdropFilter: 'blur(16px)',
    padding: '12px 16px',
  },
  success: {
    iconTheme: {
      primary: '#A31D1D',
      secondary: '#fff',
    },
  },
  error: {
    iconTheme: {
      primary: '#ef4444',
      secondary: '#fff',
    },
    style: {
      border: '1px solid rgba(239, 68, 68, 0.3)',
    },
  },
}

/* ── Provider ────────────────────────────────────────────── */
export function ToastProvider({ children }) {
  return (
    <ToastContext.Provider value={hotToast}>
      {children}
      <Toaster
        position="bottom-right"
        gutter={10}
        toastOptions={toastOptions}
      />
    </ToastContext.Provider>
  )
}

/* ── Hook ────────────────────────────────────────────────── */
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return ctx
}
