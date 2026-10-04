import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarCheck, CaretLeft, CaretRight, DownloadSimple, SignOut } from '@phosphor-icons/react'
import { Badge, Button, Empty, Field, Input, Logo, Segmented, Skeleton, cn, useToast } from '../components/ui'
import { AvailabilityForm } from '../components/AvailabilityForm'
import { api } from '../data'
import { useAuth } from '../auth/AuthContext'
import { buildIcs, downloadFile } from '../lib/ics'
import { errMsg } from '../lib/errors'
import { holidayLabel, holidayOn } from '../lib/holidays'
import type { DailyTask, Location, Member, Position, Shift, Shop } from '../lib/types'
import { DAY_LABELS, addDays, fmtDay, fmtHours, fmtMin, fmtRangeShort, monthEnd, monthStart, todayISO, weekDays, weekStart, weekdayIdx } from '../lib/time'

type Range = 'week' | 'biweek' | 'month'

export default function StaffPage() {
  const { user, loading } = useAuth()
  const nav = useNavigate()
  const [ms, setMs] = useState<{ shop: Shop; member: Member } | null | undefined>(undefined)

  const reload = useCallback(() => api.getMembership().then(setMs).catch(() => setMs(null)), [])
  useEffect(() => {
    if (loading) return
    if (!user) { nav('/auth?role=staff&next=/me', { replace: true }); return }
    reload()
  }, [user, loading, nav, reload])

  const signOut = async () => { await api.signOut(); nav('/') }

  if (ms === undefined) return <div className="mx-auto max-w-5xl p-6"><Skeleton className="h-10 w-48" /><Skeleton className="mt-6 h-64" /></div>
  return (
    <div className="mx-auto min-h-[100dvh] w-full max-w-5xl px-4 pb-10 sm:px-6">
      <header className="flex h-16 items-center justify-between">
        <Link to="/"><Logo /></Link>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-mute sm:inline">{user?.email}</span>
          <Button variant="ghost" size="sm" onClick={signOut}><SignOut size={16} />退出</Button>
        </div>
      </header>
      {ms ? <Dashboard shop={ms.shop} member={ms.member} /> : <Claim onDone={reload} />}
    </div>
  )
}

/* ---------- 绑定店铺 ---------- */
function Claim({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null)
    try { await api.claimMember(code.trim(), name.trim()); onDone() } catch (err) { setError(errMsg(err)) } finally { setBusy(false) }
  }
  return (
    <div className="max-w-sm pt-8">
      <h1 className="text-2xl font-semibold tracking-tight">绑定你的店铺</h1>
      <p className="mt-2 text-sm text-mute">输入店长给你的店铺码，再填上排班表里用的名字。之前用这个名字报过班的话，记录会自动归到你的账号下。</p>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
        <Field label="店铺码"><Input value={code} onChange={(e) => setCode(e.target.value)} required /></Field>
        <Field label="你的名字"><Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={30} /></Field>
        {error && <p className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{error}</p>}
        <Button type="submit" variant="primary" disabled={busy}>{busy ? '绑定中...' : '绑定'}</Button>
      </form>
    </div>
  )
}

/* ---------- 主界面 ---------- */
function Dashboard({ shop, member }: { shop: Shop; member: Member }) {
  const toast = useToast()
  const [tab, setTab] = useState<'schedule' | 'avail'>('schedule')
  const [range, setRange] = useState<Range>('week')
  const [week, setWeek] = useState(weekStart(todayISO(), shop.week_start))
  const [positions, setPositions] = useState<Position[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [tasks, setTasks] = useState<DailyTask[]>([])
  const [weekShifts, setWeekShifts] = useState<Shift[] | null>(null)
  const [statShifts, setStatShifts] = useState<Shift[]>([])

  const [from, to] = useMemo(() => {
    if (range === 'week') return [week, addDays(week, 6)]
    if (range === 'biweek') return [week, addDays(week, 13)]
    return [monthStart(week), monthEnd(week)]
  }, [range, week])

  useEffect(() => { api.listPositions(shop.id).then(setPositions).catch(() => {}) }, [shop.id])
  useEffect(() => { api.listLocations(shop.id).then(setLocations).catch(() => {}) }, [shop.id])
  useEffect(() => { api.listDailyTasks(shop.id, week, addDays(week, 6)).then(setTasks).catch(() => {}) }, [shop.id, week])
  useEffect(() => {
    let alive = true
    setWeekShifts(null)
    api.listMyShifts(member.id, week, addDays(week, 6)).then((s) => alive && setWeekShifts(s)).catch((e) => { toast(errMsg(e)); setWeekShifts([]) })
    return () => { alive = false }
  }, [member.id, week, toast])
  useEffect(() => {
    let alive = true
    api.listMyShifts(member.id, from, to).then((s) => alive && setStatShifts(s)).catch(() => {})
    return () => { alive = false }
  }, [member.id, from, to])

  const posOf = useMemo(() => new Map(positions.map((p) => [p.id, p])), [positions])
  const totalMin = statShifts.reduce((n, s) => n + (s.end_min - s.start_min), 0)
  const daysWorked = new Set(statShifts.map((s) => s.day)).size

  const exportIcs = () => {
    if (!statShifts.length) { toast('这个范围内还没有班次可导出'); return }
    const events = statShifts.map((s) => ({
      id: s.id, day: s.day, start: s.start_min, end: s.end_min,
      title: `${shop.name}${s.position_id && posOf.get(s.position_id) ? ' · ' + posOf.get(s.position_id)!.name : ''}`, note: s.note,
    }))
    downloadFile(`班表-${from}_${to}.ics`, buildIcs(events, `${shop.name} 班表`))
    toast('已下载，打开文件即可导入日历')
  }

  return (
    <div className="grid gap-8 pt-4 lg:grid-cols-[260px_1fr]">
      <aside className="flex flex-col gap-6">
        <div>
          <p className="text-sm text-mute">{shop.name}</p>
          <div className="mt-1 flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{member.name}</h1>
            {member.status === 'trial' && <Badge tone="warn">试工</Badge>}
          </div>
        </div>

        <div className="rounded-panel border border-line bg-surface p-4">
          <Segmented size="sm" value={range} onChange={setRange} options={[{ value: 'week', label: '周' }, { value: 'biweek', label: '双周' }, { value: 'month', label: '月' }]} />
          <p className="num mt-3 text-xs text-mute">{fmtRangeShort(from, to)}</p>
          <p className="num mt-1 text-4xl font-semibold tracking-tight">{fmtHours(totalMin)}<span className="ml-1 text-base font-normal text-mute">小时</span></p>
          <p className="mt-1 text-sm text-mute">{statShifts.length} 个班次，{daysWorked} 天上班</p>
          <Button className="mt-4 w-full" onClick={exportIcs}><DownloadSimple size={16} />导出到日历</Button>
          <p className="mt-2 text-xs text-faint">下载 .ics 文件，Google、Apple、Outlook 日历都能导入。</p>
        </div>
      </aside>

      <main className="min-w-0">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Segmented value={tab} onChange={setTab} options={[{ value: 'schedule', label: '我的班表' }, { value: 'avail', label: '填写可用时间' }]} />
          {tab === 'schedule' && (
            <div className="flex items-center gap-1">
              <Button size="sm" onClick={() => setWeek(addDays(week, -7))} aria-label="上一周"><CaretLeft size={16} /></Button>
              <span className="num min-w-[9.5rem] text-center text-sm font-medium">{fmtRangeShort(week, addDays(week, 6))}</span>
              <Button size="sm" onClick={() => setWeek(addDays(week, 7))} aria-label="下一周"><CaretRight size={16} /></Button>
            </div>
          )}
        </div>

        {tab === 'schedule'
          ? <WeekSchedule shop={shop} week={week} shifts={weekShifts} posOf={posOf} locations={locations} tasks={tasks} onFill={() => setTab('avail')} />
          : <AvailabilityForm
              hours={shop.hours} locations={locations} weekStartDay={shop.week_start} region={shop.region} canSubmit reloadKey={member.id}
              load={(ws) => api.listMyAvailability(member.id, ws, addDays(ws, 6))}
              save={(ws, entries) => api.submitAvailability(shop.code, member.name, ws, entries)}
            />}
      </main>
    </div>
  )
}

/* ---------- 周视图：横向时间条 ---------- */
function WeekSchedule({ shop, week, shifts, posOf, locations, tasks, onFill }: {
  shop: Shop; week: string; shifts: Shift[] | null; posOf: Map<string, Position>; locations: Location[]; tasks: DailyTask[]; onFill: () => void
}) {
  const locName = new Map(locations.map((l) => [l.id, l.name]))
  const multi = locations.length > 1
  const days = weekDays(week)
  const open = shop.hours.filter(Boolean) as { open: number; close: number }[]
  const axisMin = open.length ? Math.min(...open.map((h) => h.open)) : 540
  const axisMax = open.length ? Math.max(...open.map((h) => h.close)) : 1320
  const span = axisMax - axisMin
  const ticks: number[] = []
  for (let m = Math.ceil(axisMin / 120) * 120; m <= axisMax; m += 120) ticks.push(m)

  if (shifts === null) return <div className="flex flex-col gap-2">{Array.from({ length: 7 }, (_, i) => <Skeleton key={i} className="h-14" />)}</div>
  const today = todayISO()

  return (
    <div>
      {shifts.length === 0 && (
        <div className="mb-4">
          <Empty title="这一周还没有你的班次" hint="可能店长还没有发布这周的班表。发布之前，先把你能上班的时间告诉店长吧。" action={<Button variant="primary" size="sm" onClick={onFill}><CalendarCheck size={16} />填写可用时间</Button>} />
        </div>
      )}
      <div className="relative ml-[76px] mb-1 h-4 text-[11px] text-faint num" aria-hidden>
        {ticks.map((m) => <span key={m} className="absolute -translate-x-1/2" style={{ left: `${((m - axisMin) / span) * 100}%` }}>{fmtMin(m)}</span>)}
      </div>
      <div className="flex flex-col gap-2">
        {days.map((day) => {
          const list = shifts.filter((s) => s.day === day)
          const isToday = day === today
          const h = shop.hours[weekdayIdx(day)]
          return (
            <div key={day} className="flex items-stretch gap-3">
              <div className="w-[64px] shrink-0 pt-2">
                <p className={cn('text-sm font-semibold', isToday && 'text-accent')}>{DAY_LABELS[weekdayIdx(day)]}</p>
                <p className="num text-xs text-mute">{fmtDay(day)}</p>
                {holidayOn(day, shop.region) && <p className="mt-0.5 text-[11px] font-medium text-warn" title={holidayLabel(holidayOn(day, shop.region)!)}>{holidayOn(day, shop.region)!.zh}</p>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="relative h-11 rounded-control bg-sunken">
                  {ticks.map((m) => <div key={m} className="absolute inset-y-0 w-px bg-line" style={{ left: `${((m - axisMin) / span) * 100}%` }} />)}
                  {h && <div className="absolute inset-y-0 rounded-control border border-dashed border-line" style={{ left: `${((h.open - axisMin) / span) * 100}%`, width: `${((h.close - h.open) / span) * 100}%` }} />}
                  {!h && <span className="absolute inset-0 grid place-items-center text-xs text-faint">店铺休息</span>}
                  {list.map((s) => {
                    const p = s.position_id ? posOf.get(s.position_id) : undefined
                    return (
                      <div key={s.id} title={`${fmtMin(s.start_min)} - ${fmtMin(s.end_min)}`} className="absolute inset-y-1 flex items-center overflow-hidden rounded-[6px] px-2 text-xs font-medium text-white"
                        style={{ left: `${((s.start_min - axisMin) / span) * 100}%`, width: `${((s.end_min - s.start_min) / span) * 100}%`, background: p?.color ?? '#4b5563' }}>
                        <span className="num truncate">{fmtMin(s.start_min)}-{fmtMin(s.end_min)}{p ? ` ${p.name}` : ''}{multi ? ` @${locName.get(s.location_id) ?? ''}` : ''}</span>
                      </div>
                    )
                  })}
                </div>
                {list.filter((s) => s.note).map((s) => <p key={s.id} className="mt-1 text-xs text-mute">备注：{s.note}</p>)}
                {/* 当日任务：只显示我上班的那几家门店的 */}
                {tasks.filter((t) => t.day === day && list.some((s) => s.location_id === t.location_id)).map((t) => (
                  <p key={t.location_id} className="mt-1 whitespace-pre-line rounded-control bg-warn/15 px-2 py-1 text-xs text-warn">
                    <strong className="font-semibold">当日任务{multi ? `（${locName.get(t.location_id) ?? ''}）` : ''}：</strong>{t.text}
                  </p>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
