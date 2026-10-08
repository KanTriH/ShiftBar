import type { AvailEntry, DayHours } from './types'
import { mergeIntervals } from './time'
import type { Interval } from './time'

/** 报班表单里某一天填的内容 */
export interface DayInput { ranges: Interval[]; note: string; locs: string[] }

/** 某一天填得不对的原因（具体文案由界面按语言生成） */
export type DayError =
  | { kind: 'closed' } // 这天店铺休息，不能报班
  | { kind: 'order' } // 结束时间不晚于开始时间
  | { kind: 'outsideHours'; open: number; close: number } // 超出营业时间

/**
 * 校验一周的报班并生成要提交的记录。
 * - 没填时段的天直接跳过（视为不能上班）
 * - 同一天重叠或相接的时段合并成一条
 * - 只要有任何一天有错，就不应该提交（调用方检查 errors 是否为空）
 * hoursOf: 返回某一天的营业时间，休息日返回 null。
 */
export function validateWeek(
  days: string[],
  state: Record<string, DayInput | undefined>,
  hoursOf: (day: string) => DayHours | null,
): { errors: Record<string, DayError>; entries: AvailEntry[] } {
  const errors: Record<string, DayError> = {}
  const entries: AvailEntry[] = []
  for (const day of days) {
    const st = state[day]
    if (!st || !st.ranges.length) continue
    const h = hoursOf(day)
    if (!h) { errors[day] = { kind: 'closed' }; continue }
    for (const [a, b] of st.ranges) {
      if (b <= a) { errors[day] = { kind: 'order' }; break }
      if (a < h.open || b > h.close) { errors[day] = { kind: 'outsideHours', open: h.open, close: h.close }; break }
    }
    if (errors[day]) continue
    for (const [a, b] of mergeIntervals(st.ranges)) entries.push({ day, start: a, end: b, note: st.note, locations: st.locs })
  }
  return { errors, entries }
}
