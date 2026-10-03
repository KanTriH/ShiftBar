import { useEffect, useMemo, useState } from 'react'
import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import { Badge, Button, Empty, Skeleton, cn, useToast } from '../../components/ui'
import { useManager } from './ManagerLayout'
import { api } from '../../data'
import { errMsg } from '../../lib/errors'
import type { Availability } from '../../lib/types'
import { DAY_LABELS, addDays, fmtDay, fmtMin, fmtRangeShort, mergeIntervals, todayISO, weekDays, weekStart, weekdayIdx } from '../../lib/time'

export default function AvailabilityBoard() {
  const { shop, members } = useManager()
  const toast = useToast()
  const [week, setWeek] = useState(weekStart(todayISO()))
  const [rows, setRows] = useState<Availability[] | null>(null)
  const days = useMemo(() => weekDays(week), [week])

  useEffect(() => {
    let alive = true
    setRows(null)
    api.listAvailability(shop.id, week, addDays(week, 6)).then((r) => alive && setRows(r)).catch((e) => { toast(errMsg(e)); setRows([]) })
    return () => { alive = false }
  }, [shop.id, week, toast])

  const sorted = useMemo(() => [...members].sort((a, b) => a.name.localeCompare(b.name, 'zh')), [members])
  const submittedIds = new Set((rows ?? []).map((r) => r.member_id))
  const missing = sorted.filter((m) => !submittedIds.has(m.id))

  const cell = (memberId: string, day: string) => {
    const list = (rows ?? []).filter((r) => r.member_id === memberId && r.day === day)
    const h = shop.hours[weekdayIdx(day)]
    const merged = mergeIntervals(list.map((r) => [r.start_min, r.end_min]))
    return { merged, note: list.find((r) => r.note)?.note, full: !!h && merged.length === 1 && merged[0][0] <= h.open && merged[0][1] >= h.close, closed: !h }
  }
  const headcount = (day: string) => new Set((rows ?? []).filter((r) => r.day === day).map((r) => r.member_id)).size

  if (members.length === 0) return <Empty title="还没有员工报班" hint="把店铺的报班链接发给员工，他们填完后会出现在这里。链接在「设置」页。" />

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button size="sm" onClick={() => setWeek(addDays(week, -7))} aria-label="上一周"><CaretLeft size={16} /></Button>
          <span className="num min-w-[10rem] text-center text-sm font-medium">{fmtRangeShort(days[0], days[6])}</span>
          <Button size="sm" onClick={() => setWeek(addDays(week, 7))} aria-label="下一周"><CaretRight size={16} /></Button>
        </div>
        {rows && (
          <p className="text-sm text-mute">
            <span className="num font-medium text-ink">{sorted.length - missing.length}</span> / {sorted.length} 人已报班
            {missing.length > 0 && <span>，还没报：{missing.map((m) => m.name).join('、')}</span>}
          </p>
        )}
      </div>

      {rows === null ? <Skeleton className="h-72" /> : (
        <div className="thin-scroll overflow-x-auto rounded-panel border border-line bg-surface">
          <table className="w-full min-w-[820px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="sticky left-0 z-10 w-36 bg-surface px-4 py-3 text-xs font-medium text-mute">员工</th>
                {days.map((d) => (
                  <th key={d} className="px-3 py-3 text-xs font-medium text-mute">
                    <span className="text-ink">{DAY_LABELS[weekdayIdx(d)]}</span> <span className="num">{fmtDay(d).replace('月', '/').replace('日', '')}</span>
                    <div className="num mt-0.5 font-normal text-faint">{shop.hours[weekdayIdx(d)] ? `${headcount(d)} 人可上` : '休息'}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((m) => (
                <tr key={m.id} className="border-b border-line last:border-0">
                  <td className="sticky left-0 z-10 bg-surface px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">{m.name}</span>
                      {m.status === 'trial' && <Badge tone="warn">试工</Badge>}
                    </div>
                    {!submittedIds.has(m.id) && <span className="text-xs text-faint">未报班</span>}
                  </td>
                  {days.map((d) => {
                    const c = cell(m.id, d)
                    return (
                      <td key={d} className={cn('px-3 py-3 align-top', c.closed && 'bg-sunken/60')} title={c.note}>
                        {c.closed ? <span className="text-faint">-</span>
                          : c.full ? <span className="rounded bg-avail/15 px-1.5 py-0.5 text-xs font-medium text-avail">全天</span>
                          : c.merged.length ? (
                            <div className="flex flex-col gap-1">
                              {c.merged.map(([a, b], i) => <span key={i} className="num w-fit rounded bg-avail/15 px-1.5 py-0.5 text-xs text-avail">{fmtMin(a)}-{fmtMin(b)}</span>)}
                              {c.note && <span className="max-w-[120px] truncate text-[11px] text-mute">{c.note}</span>}
                            </div>
                          ) : <span className="text-faint">-</span>}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
