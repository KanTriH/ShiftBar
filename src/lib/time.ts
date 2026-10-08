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

/**
 * 分钟数 -> "HH:MM"。班次可以跨午夜：1500 = 次日 01:00，所以超过 24 小时的部分按 24 取余。
 * 恰好 1440 显示为 24:00（营业到午夜）。
 */
export function fmtMin(m: number) {
  if (m === 1440) return '24:00'
  return `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`
}
/** 给 <input type="time"> 用的值：它不接受 24:00，午夜写成 00:00 */
export const inputTime = (m: number) => fmtMin(m % 1440)
/** 这个时刻是不是已经在次日（超过 24:00） */
export const isNextDay = (m: number) => m > 1440
/**
 * 解析"开始时间"输入：早于开门时间的时刻，如果这家店营业过午夜（close > 1440），
 * 说明指的是次日凌晨，要加上 24 小时。例：9:00 开门、次日 1:00 关门，输入 01:00 -> 1500。
 * 店不过午夜时不做换算，原样返回，调用方会提示"不在营业时间内"（而不是让人看到莫名其妙的"次日"）。
 */
export function parseStartIn(v: string, open: number, close = Infinity) {
  const t = parseHM(v)
  return t < open && close > 1440 ? t + 1440 : t
}
/**
 * 解析"结束时间"输入：不晚于开始时间，说明已经过了午夜，加上 24 小时。
 * 例：17:45 - 01:00 -> 1500；17:00 - 00:00 -> 1440。
 */
export function parseEndAfter(v: string, start: number) {
  const t = parseHM(v)
  return t <= start ? t + 1440 : t
}
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
