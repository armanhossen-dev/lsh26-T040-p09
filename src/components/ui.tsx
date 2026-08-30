import { useEffect, useRef, type ReactNode } from 'react'
import { STATUS_META } from '@/lib/prediction'
import type { PredictionStatus } from '@/types'

/* --------------------------------- spinner --------------------------------- */

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.4 0 0 5.4 0 12h4z" />
    </svg>
  )
}

export function FullPageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-steel-500">
      <Spinner className="h-8 w-8 text-brand-600" />
      <p className="text-sm font-medium">{label}</p>
    </div>
  )
}

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2 p-4" aria-busy="true" aria-label="Loading data">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3">
          {Array.from({ length: cols }).map((__, c) => (
            <div key={c} className="skeleton h-9 flex-1" style={{ opacity: 1 - r * 0.13 }} />
          ))}
        </div>
      ))}
    </div>
  )
}

/* ------------------------------ status badge ------------------------------- */

export function StatusBadge({
  status,
  size = 'md'
}: {
  status: PredictionStatus
  size?: 'sm' | 'md'
}) {
  const m = STATUS_META[status]
  return (
    <span className={`badge ${m.badge} ${size === 'sm' ? 'px-2 py-0.5 text-[10px]' : ''}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label.toUpperCase()}
    </span>
  )
}

/* ---------------------------------- modal ---------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  size = 'md'
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null
  const width = size === 'sm' ? 'max-w-md' : size === 'lg' ? 'max-w-3xl' : 'max-w-xl'

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div
        className="fixed inset-0 bg-steel-950/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="flex min-h-full items-end justify-center p-0 sm:items-center sm:p-4">
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className={`relative w-full ${width} rounded-t-2xl bg-white shadow-2xl animate-pop-in sm:rounded-2xl`}
        >
          <div className="flex items-start justify-between gap-4 border-b border-steel-200 px-5 py-4">
            <div>
              <h2 className="text-lg font-bold text-steel-900">{title}</h2>
              {subtitle && <p className="mt-0.5 text-sm text-steel-500">{subtitle}</p>}
            </div>
            <button onClick={onClose} className="btn-ghost -mr-2 -mt-1 p-2" aria-label="Close dialog">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="max-h-[calc(100vh-12rem)] overflow-y-auto px-5 py-4">{children}</div>
        </div>
      </div>
    </div>
  )
}

/* --------------------------- confirmation dialog --------------------------- */

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  busy = false,
  destructive = true,
  onConfirm,
  onCancel
}: {
  open: boolean
  title: string
  message: ReactNode
  confirmLabel?: string
  busy?: boolean
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Modal open={open} onClose={busy ? () => {} : onCancel} title={title} size="sm">
      <div className="flex gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            destructive ? 'bg-red-100 text-red-600' : 'bg-brand-100 text-brand-600'
          }`}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </div>
        <div className="text-sm text-steel-600">{message}</div>
      </div>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button className="btn-secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button
          className={destructive ? 'btn-danger' : 'btn-primary'}
          onClick={onConfirm}
          disabled={busy}
        >
          {busy && <Spinner className="h-4 w-4" />}
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}

/* ------------------------------- empty state ------------------------------- */

export function EmptyState({
  icon,
  title,
  message,
  action
}: {
  icon?: ReactNode
  title: string
  message: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-steel-100 text-steel-400">
        {icon ?? (
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
          </svg>
        )}
      </div>
      <h3 className="text-base font-bold text-steel-800">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-steel-500">{message}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/* ------------------------------- error state ------------------------------- */

export function ErrorState({
  message,
  onRetry,
  compact = false
}: {
  message: string
  onRetry?: () => void
  compact?: boolean
}) {
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 ${
        compact ? 'px-4 py-3' : 'p-5'
      }`}
      role="alert"
    >
      <svg className="mt-0.5 h-5 w-5 shrink-0 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
      </svg>
      <div className="flex-1">
        <p className="text-sm font-semibold text-red-900">Something went wrong</p>
        <p className="mt-0.5 text-sm text-red-700">{message}</p>
        {onRetry && (
          <button onClick={onRetry} className="mt-3 text-sm font-semibold text-red-700 underline hover:text-red-900">
            Try again
          </button>
        )}
      </div>
    </div>
  )
}

/* ---------------------------------- field ---------------------------------- */

export function Field({
  label,
  error,
  hint,
  required,
  children
}: {
  label: string
  error?: string
  hint?: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <div>
      <label className="label">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error ? (
        <p className="err">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-steel-400">{hint}</p>
      ) : null}
    </div>
  )
}

/* -------------------------------- misc bits -------------------------------- */

export function PageHeader({
  title,
  subtitle,
  actions
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-steel-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-steel-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function currency(n: number): string {
  return `৳${Math.round(n).toLocaleString('en-BD')}`
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

/**
 * Recharts passes tooltip values as `string | number | array | undefined`.
 * This narrows them to a number for our formatters.
 */
export function chartNum(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

export function km(n: number | null | undefined): string {
  return n === null || n === undefined ? '—' : `${Math.round(n).toLocaleString()} km`
}
