// 加拿大法定假日（按日期规则计算，不依赖网络）。
// 仅作排班提醒：各省的法定假日、遇周末顺延和假日工资规定以官方公告为准。

import { getLang } from '../i18n/core'

export interface Holiday { en: string; zh: string }
export const REGIONS: { value: string; zh: string; en: string }[] = [
  { value: 'CA', zh: '加拿大（联邦通用）', en: 'Canada (federal)' },
  { value: 'ON', zh: '安大略 Ontario', en: 'Ontario' },
  { value: 'BC', zh: '不列颠哥伦比亚 British Columbia', en: 'British Columbia' },
  { value: 'AB', zh: '艾伯塔 Alberta', en: 'Alberta' },
  { value: 'SK', zh: '萨斯喀彻温 Saskatchewan', en: 'Saskatchewan' },
  { value: 'QC', zh: '魁北克 Quebec', en: 'Quebec' },
  { value: 'NONE', zh: '不显示假日提醒', en: 'No holiday reminders' },
]
export const regionLabel = (r: { zh: string; en: string }) => (getLang() === 'zh' ? r.zh : r.en)

const NAMES = {
  newYear: { en: "New Year's Day", zh: '元旦' },
  family: { en: 'Family Day', zh: '家庭日' },
  goodFriday: { en: 'Good Friday', zh: '耶稣受难日' },
  victoria: { en: 'Victoria Day', zh: '维多利亚日' },
  patriots: { en: "National Patriots' Day", zh: '爱国者日' },
  stJean: { en: 'Fête nationale du Québec', zh: '魁北克国庆日' },
  canada: { en: 'Canada Day', zh: '加拿大国庆日' },
  bcDay: { en: 'BC Day', zh: '不列颠哥伦比亚日' },
  skDay: { en: 'Saskatchewan Day', zh: '萨斯喀彻温日' },
  labour: { en: 'Labour Day', zh: '劳动节' },
  truth: { en: 'National Day for Truth and Reconciliation', zh: '真相与和解日' },
  thanks: { en: 'Thanksgiving', zh: '感恩节' },
  remembrance: { en: 'Remembrance Day', zh: '国殇纪念日' },
  christmas: { en: 'Christmas Day', zh: '圣诞节' },
  boxing: { en: 'Boxing Day', zh: '节礼日' },
} satisfies Record<string, Holiday>
type Key = keyof typeof NAMES

const BY_REGION: Record<string, Key[]> = {
  CA: ['newYear', 'goodFriday', 'victoria', 'canada', 'truth', 'labour', 'thanks', 'remembrance', 'christmas', 'boxing'],
  ON: ['newYear', 'family', 'goodFriday', 'victoria', 'canada', 'labour', 'thanks', 'christmas', 'boxing'],
  BC: ['newYear', 'family', 'goodFriday', 'victoria', 'canada', 'bcDay', 'labour', 'truth', 'thanks', 'remembrance', 'christmas'],
  AB: ['newYear', 'family', 'goodFriday', 'victoria', 'canada', 'labour', 'thanks', 'remembrance', 'christmas'],
  SK: ['newYear', 'family', 'goodFriday', 'victoria', 'canada', 'skDay', 'labour', 'thanks', 'remembrance', 'christmas'],
  QC: ['newYear', 'goodFriday', 'patriots', 'stJean', 'canada', 'labour', 'thanks', 'christmas'],
}

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}` // m: 0 起
/** 某月第 n 个星期几（weekday: 0 = 周日） */
function nthWeekday(y: number, m: number, weekday: number, n: number) {
  const first = new Date(y, m, 1).getDay()
  return 1 + ((weekday - first + 7) % 7) + (n - 1) * 7
}
/** 5 月 25 日之前的最后一个周一（维多利亚日 / 爱国者日） */
function mondayBeforeMay25(y: number) {
  const d = new Date(y, 4, 24)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d.getDate()
}
/** 复活节（Anonymous Gregorian 算法），返回 [月(0 起), 日] */
function easter(y: number): [number, number] {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return [month, day]
}

const cache = new Map<string, Map<string, Holiday>>()

/** 某年某地区的法定假日：日期 -> 名称 */
export function holidaysOf(year: number, region: string): Map<string, Holiday> {
  const ck = `${year}-${region}`
  const hit = cache.get(ck)
  if (hit) return hit
  const out = new Map<string, Holiday>()
  const [em, ed] = easter(year)
  const gf = new Date(year, em, ed - 2)
  const dates: Record<Key, string> = {
    newYear: iso(year, 0, 1),
    family: iso(year, 1, nthWeekday(year, 1, 1, 3)),
    goodFriday: iso(year, gf.getMonth(), gf.getDate()),
    victoria: iso(year, 4, mondayBeforeMay25(year)),
    patriots: iso(year, 4, mondayBeforeMay25(year)),
    stJean: iso(year, 5, 24),
    canada: iso(year, 6, 1),
    bcDay: iso(year, 7, nthWeekday(year, 7, 1, 1)),
    skDay: iso(year, 7, nthWeekday(year, 7, 1, 1)),
    labour: iso(year, 8, nthWeekday(year, 8, 1, 1)),
    truth: iso(year, 8, 30),
    thanks: iso(year, 9, nthWeekday(year, 9, 1, 2)),
    remembrance: iso(year, 10, 11),
    christmas: iso(year, 11, 25),
    boxing: iso(year, 11, 26),
  }
  for (const k of BY_REGION[region] ?? []) out.set(dates[k], NAMES[k])
  cache.set(ck, out)
  return out
}

/** 某一天是不是法定假日 */
export function holidayOn(day: string, region: string): Holiday | null {
  if (!region || region === 'NONE') return null
  return holidaysOf(Number(day.slice(0, 4)), region).get(day) ?? null
}
/** 中文界面显示「中文 英文」，英文界面只显示英文 */
export const holidayLabel = (h: Holiday) => (getLang() === 'zh' ? `${h.zh} ${h.en}` : h.en)
/** 只取当前语言的名字 */
export const holidayName = (h: Holiday) => (getLang() === 'zh' ? h.zh : h.en)
