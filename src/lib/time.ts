import { getLang, translate } from '../i18n/core'

/** 中文原文；显示时用 dayLabel(i) 取当前语言 */
export const DAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
export const dayLabel = (i: number) => translate(DAY_LABELS[i])
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const pad = (n: number) => String(n).padStart(2, '0')

export function toISO(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
export function fromISO(s: string) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
export function addDays(s: string, n: number) { const d = fromISO(s); d.setDate(d.getDate() + n); return toISO(d) }
export const todayISO = () => toISO(new Date())
/** 一周的起始日：startDay 1 = 周一（默认），0 = 周日 */
export function weekStart(s: string, startDay: 0 | 1 = 1) {
  const d = fromISO(s)
  d.setDate(d.getDate() - ((d.getDay() - startDay + 7) % 7))
  return toISO(d)
}
export function weekdayIdx(s: string) { return (fromISO(s).getDay() + 6) % 7 }
export function weekDays(ws: string) { return Array.from({ length: 7 }, (_, i) => addDays(ws, i)) }
export function monthStart(s: string) { const d = fromISO(s); return toISO(new Date(d.getFullYear(), d.getMonth(), 1)) }
export function monthEnd(s: string) { const d = fromISO(s); return toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0)) }

export function fmtMin(m: number) { return m >= 1440 ? '24:00' : `${pad(Math.floor(m / 60))}:${pad(m % 60)}` }
export function parseHM(v: string, asEnd = false) {
  const [h, m] = v.split(':').map(Number)
  const t = h * 60 + m
  return asEnd && t === 0 ? 1440 : t
}
export function fmtHours(min: number) { const h = min / 60; return Number.isInteger(h) ? String(h) : h.toFixed(1) }
export function fmtDay(s: string) {
  const d = fromISO(s)
  return getLang() === 'zh' ? `${d.getMonth() + 1}月${d.getDate()}日` : `${MONTHS_EN[d.getMonth()]} ${d.getDate()}`
}
/** 9/28 这种不分语言的短日期 */
export function fmtMD(s: string) { const d = fromISO(s); return `${d.getMonth() + 1}/${d.getDate()}` }
export function fmtRangeShort(a: string, b: string) { return `${fmtDay(a)} - ${fmtDay(b)}` }
export const snap = (m: number, step = 15) => Math.round(m / step) * step
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export type Interval = [number, number]
export function mergeIntervals(list: Interval[]): Interval[] {
  const s = [...list].sort((a, b) => a[0] - b[0])
  const out: Interval[] = []
  for (const [a, b] of s) {
    const last = out[out.length - 1]
    if (last && a <= last[1]) last[1] = Math.max(last[1], b)
    else out.push([a, b])
  }
  return out
}
export function covers(merged: Interval[], a: number, b: number) { return merged.some(([x, y]) => x <= a && y >= b) }
