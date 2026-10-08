import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import { X } from '@phosphor-icons/react'
import { translate as t } from '../i18n/core'

export const cn = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ')

/* ---------- Button ---------- */
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:opacity-90',
  secondary: 'bg-surface text-ink border border-line hover:bg-sunken',
  ghost: 'text-mute hover:bg-sunken hover:text-ink',
  danger: 'bg-surface text-danger border border-line hover:bg-sunken',
}
export function Button({ variant = 'secondary', size = 'md', className, ...p }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' }) {
  return (
    <button
      {...p}
      className={cn(
        'press inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control font-medium disabled:pointer-events-none disabled:opacity-50',
        size === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-10 px-4 text-sm',
        VARIANTS[variant], className,
      )}
    />
  )
}

/* ---------- Form ---------- */
const controlCls = 'h-10 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 disabled:opacity-60'
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
    <div className="inline-flex rounded-control border border-line bg-sunken p-0.5" role="tablist">
      {options.map((o) => (
        <button
          key={o.value} role="tab" aria-selected={o.value === value} onClick={() => onChange(o.value)}
          className={cn('press rounded-[6px] font-medium', size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-[13px]',
            o.value === value ? 'bg-surface text-ink shadow-sm' : 'text-mute hover:text-ink')}
        >{o.label}</button>
      ))}
    </div>
  )
}

/* ---------- Badge ---------- */
export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'warn' | 'good' }) {
  const t = { neutral: 'bg-sunken text-mute', accent: 'bg-accent-soft text-accent', warn: 'bg-warn/15 text-warn', good: 'bg-avail/15 text-avail' }[tone]
  return <span className={cn('inline-flex h-5 items-center rounded-full px-2 text-[11px] font-medium', t)}>{children}</span>
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
        className="pop w-full rounded-t-panel border border-line bg-surface p-5 shadow-xl sm:rounded-panel" style={{ maxWidth: width }}>
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
// 图形与 public/brand/shiftbar-mark-*.svg 完全一致：4×3 的方格，中间一条长"药丸"就是一个班次。
// 颜色走 CSS 变量（见 index.css），所以会跟着浅色 / 深色模式切换。
const LOGO_CELLS: [number, number][] = [[0, 0], [16, 0], [32, 0], [48, 0], [48, 16], [0, 32], [16, 32], [32, 32]]

/** ShiftBar 品牌标识：图形 + 字标。品牌名不翻译。 */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <svg width="27" height="20" viewBox="0 0 60 44" aria-hidden>
        {LOGO_CELLS.map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width="12" height="12" rx="3" fill="var(--logo-cell)" />)}
        <rect x="0" y="16" width="44" height="12" rx="6" fill="var(--logo-bar)" />
        <rect x="48" y="32" width="12" height="12" rx="3" fill="var(--logo-dot)" />
      </svg>
      <span className="font-logo text-[1.15em] font-semibold leading-none" style={{ color: 'var(--logo-ink)' }}>ShiftBar</span>
    </span>
  )
}
