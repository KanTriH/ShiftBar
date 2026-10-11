import { useEffect, useMemo, useState } from 'react'
import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import { roleDot, roleStyle } from '../../lib/roles'
import { Badge, Button, Empty, Segmented, Skeleton, cn, useToast } from '../../components/ui'
import { holidayLabel, holidayOn } from '../../lib/holidays'
import { translate as t } from '../../i18n/core'
import { useManager } from './ManagerLayout'
import { api } from '../../data'
import { errMsg } from '../../lib/errors'
import type { Availability } from '../../lib/types'
import { addDays, dayLabel, fmtMD, fmtMin, fmtRangeShort, mergeIntervals, todayISO, weekDays, weekStart, weekdayIdx } from '../../lib/time'

export default function AvailabilityBoard() {
  const { shop, locations, positions, members, skills } = useManager()
  const toast = useToast()
  const [week, setWeek] = useState(weekStart(todayISO(), shop.week_start))
  const [allRows, setRows] = useState<Availability[] | null>(null)
  const [loc, setLoc] = useState('all')
  // 只看会某个岗位的人；没勾过任何岗位的员工默认不显示，可以单独打开
  const [posFilter, setPosFilter] = useState<string>('all')
  const [withUnset, setWithUnset] = useState(false)
  const locName = useMemo(() => new Map(locations.map((l) => [l.id, l.name])), [locations])
  // 选了某家门店时，只看能去这家门店的报班（没限定门店的人也算）
  const rows = useMemo(() => allRows && (loc === 'all' ? allRows : allRows.filter((r) => r.location_ids.length === 0 || r.location_ids.includes(loc))), [allRows, loc])
  const days = useMemo(() => weekDays(week), [week])

  useEffect(() => {
    let alive = true
    setRows(null)
    api.listAvailability(shop.id, week, addDays(week, 6)).then((r) => alive && setRows(r)).catch((e) => { toast(errMsg(e)); setRows([]) })
    return () => { alive = false }
  }, [shop.id, week, toast])

  const filtered = useMemo(() => {
    if (posFilter === 'all') return members
    return members.filter((m) => {
      const sk = skills.get(m.id)
      return sk ? sk.has(posFilter) : withUnset
    })
  }, [members, skills, posFilter, withUnset])
  const unsetCount = useMemo(() => members.filter((m) => !skills.get(m.id)?.size).length, [members, skills])
  const sorted = useMemo(() => [...filtered].sort((a, b) => a.name.localeCompare(b.name, 'zh')), [filtered])
  const shownIds = useMemo(() => new Set(sorted.map((m) => m.id)), [sorted])
  const submittedIds = new Set((allRows ?? []).map((r) => r.member_id))
  const missing = sorted.filter((m) => !submittedIds.has(m.id))

  const cell = (memberId: string, day: string) => {
    const list = (rows ?? []).filter((r) => r.member_id === memberId && r.day === day)
    const h = shop.hours[weekdayIdx(day)]
    const merged = mergeIntervals(list.map((r) => [r.start_min, r.end_min]))
    const only = loc === 'all' ? [...new Set(list.flatMap((r) => r.location_ids))].map((id) => locName.get(id) ?? '').filter(Boolean) : []
    return { merged, only, note: list.find((r) => r.note)?.note, full: !!h && merged.length === 1 && merged[0][0] <= h.open && merged[0][1] >= h.close, closed: !h }
  }
  const headcount = (day: string) => new Set((rows ?? []).filter((r) => r.day === day && shownIds.has(r.member_id)).map((r) => r.member_id)).size

  if (members.length === 0) return <Empty title={t('还没有员工报班')} hint={t('把店铺的报班链接发给员工，他们填完后会出现在这里。链接在「设置」页。')} />

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button size="sm" onClick={() => setWeek(addDays(week, -7))} aria-label={t('上一周')}><CaretLeft size={16} /></Button>
          <span className="num min-w-[10rem] text-center text-sm font-medium">{fmtRangeShort(days[0], days[6])}</span>
          <Button size="sm" onClick={() => setWeek(addDays(week, 7))} aria-label={t('下一周')}><CaretRight size={16} /></Button>
        </div>
        {locations.length > 1 && <Segmented size="sm" value={loc} onChange={setLoc} options={[{ value: 'all', label: t('全部门店') }, ...locations.map((l) => ({ value: l.id, label: l.name }))]} />}
        {rows && (
          <p className="text-sm text-mute">
            <span className="num font-medium text-ink">{sorted.length - missing.length}</span> / {sorted.length} {t('人已报班')}
            {missing.length > 0 && <span>{t('，还没报：')}{missing.map((m) => m.name).join(t('、'))}</span>}
          </p>
        )}
      </div>

      {positions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-mute">{t('岗位')}</span>
          <button onClick={() => setPosFilter('all')} aria-pressed={posFilter === 'all'}
            className={cn('press h-9 rounded-full border px-3.5 text-[13px] font-semibold', posFilter === 'all' ? 'border-ink bg-ink text-bg' : 'border-line bg-surface text-mute hover:bg-sunken')}>{t('全部')}</button>
          {positions.map((p) => {
            const n = members.filter((m) => skills.get(m.id)?.has(p.id)).length
            return (
              <button key={p.id} onClick={() => setPosFilter(p.id)} aria-pressed={posFilter === p.id} title={t('只看会「{name}」的人', { name: p.name })}
                className={cn('press flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-semibold', posFilter !== p.id && 'border-line bg-surface text-mute hover:bg-sunken')}
                style={posFilter === p.id ? roleStyle(p.color) : undefined}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: roleDot(p.color) }} />{p.name}<span className="num text-[11px] font-medium opacity-70">{n}</span>
              </button>
            )
          })}
          {posFilter !== 'all' && unsetCount > 0 && (
            <label className="ml-1 flex cursor-pointer items-center gap-2 text-xs text-mute">
              <input type="checkbox" checked={withUnset} onChange={(e) => setWithUnset(e.target.checked)} className="accent-[var(--accent)]" />
              {t('同时显示还没设置岗位的 {n} 位员工', { n: unsetCount })}
            </label>
          )}
        </div>
      )}

      {rows === null ? <Skeleton className="h-72" /> : sorted.length === 0 ? (
        <Empty title={t('没有人会这个岗位')} hint={t('到「员工」页勾选每个人会的岗位，这里才会出现人。')} />
      ) : (
        <div className="thin-scroll overflow-x-auto rounded-panel border border-line bg-surface">
          <table className="w-full min-w-[820px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="sticky left-0 z-10 w-36 bg-surface px-4 py-3 text-xs font-medium text-mute">{t('员工')}</th>
                {days.map((d) => (
                  <th key={d} className="px-3 py-3 text-xs font-medium text-mute">
                    <span className="text-ink">{dayLabel(weekdayIdx(d))}</span>{holidayOn(d, shop.region) && <span className="ml-1 font-medium text-warn" title={holidayLabel(holidayOn(d, shop.region)!)}>{t('假')}</span>} <span className="num">{fmtMD(d)}</span>
                    <div className="num mt-0.5 font-normal text-faint">{shop.hours[weekdayIdx(d)] ? t('{n} 人可上', { n: headcount(d) }) : t('休息')}</div>
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
                      {m.status === 'trial' && <Badge tone="warn">{t('试工')}</Badge>}
                    </div>
                    {!submittedIds.has(m.id) && <span className="text-xs text-faint">{t('未报班')}</span>}
                  </td>
                  {days.map((d) => {
                    const c = cell(m.id, d)
                    return (
                      <td key={d} className={cn('px-3 py-3 align-top', c.closed && 'bg-sunken/60')} title={c.note}>
                        {c.closed ? <span className="text-faint">-</span>
                          : c.full ? <span className="rounded bg-avail/15 px-1.5 py-0.5 text-xs font-medium text-avail">{t('全天')}</span>
                          : c.merged.length ? (
                            <div className="flex flex-col gap-1">
                              {c.merged.map(([a, b], i) => <span key={i} className="num w-fit rounded bg-avail/15 px-1.5 py-0.5 text-xs text-avail">{fmtMin(a)}-{fmtMin(b)}</span>)}
                              {c.only.length > 0 && <span className="max-w-[120px] truncate text-[11px] text-accent">{t('仅')} {c.only.join(t('、'))}</span>}
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
