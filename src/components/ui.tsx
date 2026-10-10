import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import { X } from '@phosphor-icons/react'
import { translate as t } from '../i18n/core'

export const cn = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ')

/* ---------- Button ---------- */
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-ink text-bg hover:opacity-90',
  secondary: 'bg-transparent text-ink border border-ink/70 hover:bg-sunken',
  ghost: 'text-mute hover:bg-sunken hover:text-ink',
  danger: 'bg-transparent text-danger border border-danger/50 hover:bg-danger/10',
}
export function Button({ variant = 'secondary', size = 'md', className, ...p }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' }) {
  return (
    <button
      {...p}
      className={cn(
        'press inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold disabled:pointer-events-none disabled:opacity-50',
        size === 'sm' ? 'h-9 px-4 text-[13px]' : 'h-11 px-5 text-sm',
        VARIANTS[variant], className,
      )}
    />
  )
}

/* ---------- Form ---------- */
const controlCls = 'h-11 w-full rounded-control border border-line-strong bg-surface px-3.5 text-sm text-ink placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 disabled:opacity-60'
export const Input = ({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cn(controlCls, className)} />
export const Select = ({ className, ...p }: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cn(controlCls, 'pr-8', className)} />

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string | null; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[13px] font-medium text-ink">{label}</span>
      {children}
      {hint && !error && <span className="text-xs text-mute">{hint}</span>}
      {error && <span className="text-xs text-danger" role="alert">{error}</span>}
    </label>
  )
}

/* ---------- Segmented ---------- */
export function Segmented<T extends string>({ value, onChange, options, size = 'md' }:
  { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; size?: 'sm' | 'md' }) {
  return (
    <div className="inline-flex rounded-full bg-sunken p-1" role="tablist">
      {options.map((o) => (
        <button
          key={o.value} role="tab" aria-selected={o.value === value} onClick={() => onChange(o.value)}
          className={cn('press rounded-full font-semibold', size === 'sm' ? 'h-8 px-3.5 text-xs' : 'h-9 px-4 text-[13px]',
            o.value === value ? 'bg-ink text-bg' : 'text-mute hover:text-ink')}
        >{o.label}</button>
      ))}
    </div>
  )
}

/* ---------- Badge ---------- */
export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'warn' | 'good' }) {
  const t = { neutral: 'bg-off-soft text-off-ink', accent: 'bg-accent-soft text-accent', warn: 'bg-warn-soft text-warn', good: 'bg-avail-soft text-avail' }[tone]
  return <span className={cn('inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-semibold', t)}>{children}</span>
}

/* ---------- Modal ---------- */
export function Modal({ open, onClose, title, children, width = 440 }: { open: boolean; onClose: () => void; title: string; children: ReactNode; width?: number }) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}
        className="pop w-full rounded-t-panel border border-line bg-surface p-6 shadow-xl sm:rounded-panel" style={{ maxWidth: width }}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} aria-label={t('关闭')} className="press rounded-control p-1.5 text-mute hover:bg-sunken"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

/* ---------- Skeleton / Empty ---------- */
export const Skeleton = ({ className }: { className?: string }) => <div className={cn('skeleton', className)} />

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-panel border border-dashed border-line px-6 py-10">
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="max-w-[46ch] text-sm text-mute">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

/* ---------- Toast ---------- */
interface ToastItem { id: number; msg: string; action?: { label: string; run: () => void } }
const ToastCtx = createContext<(msg: string, action?: ToastItem['action']) => void>(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const n = useRef(0)
  const push = useCallback((msg: string, action?: ToastItem['action']) => {
    const id = ++n.current
    setItems((x) => [...x, { id, msg, action }])
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), action ? 6000 : 3200)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className="pop pointer-events-auto flex items-center gap-3 rounded-control bg-ink px-4 py-2.5 text-sm text-bg shadow-lg">
            <span>{t.msg}</span>
            {t.action && (
              <button className="font-semibold underline underline-offset-2" onClick={() => { t.action!.run(); setItems((x) => x.filter((i) => i.id !== t.id)) }}>
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

/* ---------- Logo ---------- */
/**
 * ShiftBar 标识：三条错位的"班次条"（中间一条是陶土色）+ 字标。品牌名不翻译。
 * 尺寸全部用 em，外层给一个 text-* 字号就会等比缩放。
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-[0.45em]', className)}>
      <svg viewBox="0 0 28 20" style={{ width: '1.5em', height: '1.07em' }} aria-hidden>
        <rect x="0" y="0" width="17" height="5" rx="2.5" fill="var(--ink)" />
        <rect x="0" y="7.5" width="26" height="5" rx="2.5" fill="var(--accent)" />
        <rect x="0" y="15" width="11" height="5" rx="2.5" fill="var(--ink)" />
      </svg>
      <span className="font-display text-[1.15em] font-extrabold leading-none tracking-[-0.03em]">ShiftBar</span>
    </span>
  )
}
