/**
 * 把"某一天的第几分钟"变成一条连续的时间轴上的位置，这样跨午夜的班次（结束时间 > 1440）
 * 和第二天凌晨的班次也能正确比较。和数据库里的 shifts.span 是同一个算法（迁移 0008）。
 */
const EPOCH = Date.UTC(2000, 0, 1)
const dayNumber = (day: string) => {
  const [y, m, d] = day.split('-').map(Number)
  return Math.round((Date.UTC(y, m - 1, d) - EPOCH) / 86400000)
}

export interface TimedShift { day: string; start_min: number; end_min: number }

export function absSpan(s: TimedShift): [number, number] {
  const base = dayNumber(s.day) * 1440
  return [base + s.start_min, base + s.end_min]
}

/** 两个班次是否在时间上重叠（首尾相接不算重叠） */
export function spansOverlap(a: TimedShift, b: TimedShift): boolean {
  const [a0, a1] = absSpan(a)
  const [b0, b1] = absSpan(b)
  return a0 < b1 && b0 < a1
}
