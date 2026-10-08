import type { Availability, Shift } from './types'
import { covers, mergeIntervals } from './time'

/** 排班时需要提醒店长的问题（只有类型，具体文案由界面按语言生成） */
export type ShiftIssue =
  | { kind: 'overlap' } // 和同一个人在同一门店的另一个班次时间重叠
  | { kind: 'otherLocation'; locationId: string } // 同一时间已在其他门店排了班
  | { kind: 'outsideAvailability' } // 超出该员工报的可用时间

const overlaps = (a: Shift, b: Shift) => b.start_min < a.end_min && b.end_min > a.start_min

/**
 * 计算某一天、某家门店里每个班次的问题。
 * - shifts: 当前门店这一天的班次（拖动中的班次传入预览后的值）
 * - otherShifts: 同一天在其他门店的班次，只读，用来发现重复排班
 * - avail: 这一天、能去当前门店的报班
 * - submitted: 这一周提交过报班的员工。没提交过的人不判断"超出可用时间"，因为不知道他们什么时候有空
 * 返回的 Map 里只有"有问题"的班次。
 */
export function computeShiftIssues(opts: {
  shifts: Shift[]
  otherShifts: Shift[]
  avail: Availability[]
  submitted: Set<string>
}): Map<string, ShiftIssue[]> {
  const { shifts, otherShifts, avail, submitted } = opts

  const availByMember = new Map<string, [number, number][]>()
  for (const a of avail) {
    const list = availByMember.get(a.member_id) ?? []
    list.push([a.start_min, a.end_min])
    availByMember.set(a.member_id, list)
  }

  const out = new Map<string, ShiftIssue[]>()
  for (const s of shifts) {
    const issues: ShiftIssue[] = []
    if (shifts.some((o) => o.id !== s.id && o.member_id === s.member_id && overlaps(s, o))) issues.push({ kind: 'overlap' })
    const clash = otherShifts.find((o) => o.member_id === s.member_id && overlaps(s, o))
    if (clash) issues.push({ kind: 'otherLocation', locationId: clash.location_id })
    if (submitted.has(s.member_id)) {
      const merged = mergeIntervals(availByMember.get(s.member_id) ?? [])
      if (!covers(merged, s.start_min, s.end_min)) issues.push({ kind: 'outsideAvailability' })
    }
    if (issues.length) out.set(s.id, issues)
  }
  return out
}
