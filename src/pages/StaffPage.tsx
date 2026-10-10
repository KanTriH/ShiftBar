import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, CaretLeft, CaretRight, DownloadSimple } from '@phosphor-icons/react'
import { Badge, Button, Field, Input, Logo, Segmented, Skeleton, cn, useToast } from '../components/ui'
import { roleStyle } from '../lib/roles'
import { AvailabilityForm } from '../components/AvailabilityForm'
import { DeleteAccountModal } from '../components/DeleteAccountModal'
import { api } from '../data'
import { useAuth } from '../auth/AuthContext'
import { buildIcs, downloadFile } from '../lib/ics'
import { errMsg } from '../lib/errors'
import { holidayLabel, holidayName, holidayOn } from '../lib/holidays'
import { LangSwitch } from '../i18n'
import { translate as t } from '../i18n/core'
import type { DailyTask, Location, Member, Position, Shift, Shop } from '../lib/types'
import { addDays, dayLabel, fmtDay, fmtHours, fmtMin, fmtRangeShort, fromISO, monthEnd, monthStart, toISO, todayISO, weekDays, weekStart, weekdayIdx } from '../lib/time'

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

  if (ms === undefined) return <div className="mx-auto max-w-[1280px] p-6"><Skeleton className="h-10 w-48" /><Skeleton className="mt-6 h-64" /></div>
  return (
    <div className="mx-auto min-h-[100dvh] w-full max-w-[1280px] px-4 pb-12 sm:px-8">
      <header className="flex h-16 items-center justify-between border-b border-line">
        <Link to="/"><Logo className="text-xl" /></Link>
        <div className="flex items-center gap-4 text-sm text-mute">
          <span className="hidden sm:inline">{user?.email}</span>
          <LangSwitch />
          <button onClick={signOut} className="press font-medium hover:text-ink">{t('退出')}</button>
        </div>
      </header>
      {ms ? <Dashboard shop={ms.shop} member={ms.member} /> : <Claim onDone={reload} />}
    </div>
  )
}

/* ---------- 账号入口：修改密码 / 注销账号 ---------- */
function AccountLinks({ shopName }: { shopName?: string }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  if (!user) return null
  return (
    <div className="flex flex-col items-start gap-1.5 text-sm">
      <Link to="/reset-password" className="text-mute hover:text-ink">{t('修改密码')}</Link>
      <button onClick={() => setOpen(true)} className="text-mute hover:text-danger">{t('注销账号')}</button>
      <DeleteAccountModal open={open} onClose={() => setOpen(false)} email={user.email} role="staff" shopName={shopName} />
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
      <h1 className="text-2xl font-semibold tracking-tight">{t('绑定你的店铺')}</h1>
      <p className="mt-2 text-sm text-mute">{t('输入店长给你的店铺码，再填上排班表里用的名字。之前用这个名字报过班的话，记录会自动归到你的账号下。')}</p>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
        <Field label={t('店铺码')}><Input value={code} onChange={(e) => setCode(e.target.value)} required /></Field>
        <Field label={t('你的名字')}><Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={30} /></Field>
        {error && <p className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{error}</p>}
        <Button type="submit" variant="primary" disabled={busy}>{busy ? t('绑定中...') : t('绑定')}</Button>
      </form>
      <div className="mt-8 border-t border-line pt-4"><AccountLinks /></div>
    </div>
  )
}

/* ---------- 主界面 ---------- */
const daysBetween = (a: string, b: string) => Math.round((fromISO(a).getTime() - fromISO(b).getTime()) / 86400000)
/** 分钟数 -> "3h 15m" / "45m" / "2d 3h" */
function fmtDur(min: number) {
  const m = Math.max(0, Math.round(min))
  if (m >= 1440) return `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h`
  const h = Math.floor(m / 60)
  return h ? `${h}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`
}

const RoundBtn = ({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) => (
  <button onClick={onClick} aria-label={label} className="press grid h-11 w-11 place-items-center rounded-full border border-line-strong text-ink hover:bg-sunken">{children}</button>
)

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
  const [upcoming, setUpcoming] = useState<Shift[]>([])
  const [nextWeekFilled, setNextWeekFilled] = useState<boolean | null>(null)
  const [now, setNow] = useState(() => new Date())

  const today = toISO(now)
  const nextWeek = addDays(weekStart(today, shop.week_start), 7)

  const [from, to] = useMemo(() => {
    if (range === 'week') return [week, addDays(week, 6)]
    if (range === 'biweek') return [week, addDays(week, 13)]
    return [monthStart(week), monthEnd(week)]
  }, [range, week])

  useEffect(() => { const id = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(id) }, [])
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
  // 下一个班：从昨天开始往后取一个月（昨天的跨午夜班次今天凌晨可能还没结束）
  useEffect(() => {
    let alive = true
    const t0 = toISO(new Date())
    api.listMyShifts(member.id, addDays(t0, -1), addDays(t0, 30)).then((s) => alive && setUpcoming(s)).catch(() => {})
    return () => { alive = false }
  }, [member.id])
  // 下周的可用时间填过没有
  useEffect(() => {
    let alive = true
    api.listMyAvailability(member.id, nextWeek, addDays(nextWeek, 6)).then((a) => alive && setNextWeekFilled(a.length > 0)).catch(() => {})
    return () => { alive = false }
  }, [member.id, nextWeek])

  const posOf = useMemo(() => new Map(positions.map((p) => [p.id, p])), [positions])
  const totalMin = statShifts.reduce((n, s) => n + (s.end_min - s.start_min), 0)
  const daysWorked = new Set(statShifts.map((s) => s.day)).size
  const locName = new Map(locations.map((l) => [l.id, l.name]))

  /* 下一个（或正在进行的）班 */
  const next = useMemo(() => {
    const nowAbs = now.getHours() * 60 + now.getMinutes()
    const abs = (s: Shift, which: 'start' | 'end') => daysBetween(s.day, today) * 1440 + (which === 'start' ? s.start_min : s.end_min)
    const live = upcoming.filter((s) => abs(s, 'end') > nowAbs).sort((a, b) => abs(a, 'start') - abs(b, 'start'))
    if (!live.length) return null
    const first = live[0]
    const sameDay = upcoming.filter((s) => s.day === first.day && abs(s, 'end') > nowAbs).sort((a, b) => a.start_min - b.start_min)
    const inProgress = abs(first, 'start') <= nowAbs
    return {
      day: first.day, shifts: sameDay, first, inProgress,
      minutes: inProgress ? abs(first, 'end') - nowAbs : abs(first, 'start') - nowAbs,
      rangeStart: Math.min(...sameDay.map((s) => s.start_min)), rangeEnd: Math.max(...sameDay.map((s) => s.end_min)),
    }
  }, [upcoming, now, today])

  const exportIcs = () => {
    if (!statShifts.length) { toast(t('这个范围内还没有班次可导出')); return }
    const events = statShifts.map((s) => ({
      id: s.id, day: s.day, start: s.start_min, end: s.end_min,
      title: `${shop.name}${s.position_id && posOf.get(s.position_id) ? ' · ' + posOf.get(s.position_id)!.name : ''}`, note: s.note,
    }))
    downloadFile(`${t('班表')}-${from}_${to}.ics`, buildIcs(events, `${shop.name} ${t('班表')}`))
    toast(t('已下载，打开文件即可导入日历'))
  }

  const dayName = (day: string) => (day === today ? t('今天') : dayLabel(weekdayIdx(day)))
  const placeLabel = locations.length ? (next ? locName.get(next.first.location_id) : locations[0]?.name) : undefined

  return (
    <div className="grid gap-x-8 gap-y-6 pt-8 lg:grid-cols-[300px_minmax(0,1fr)]">
      {/* 问候 */}
      <div>
        <p className="text-sm text-mute">{shop.name}{placeLabel ? ` · ${placeLabel}` : ''}</p>
        <h1 className="mt-1 break-words font-display text-[clamp(3rem,6vw,4.5rem)] font-extrabold leading-[0.95] tracking-[-0.04em]">Hi,<br />{member.name}</h1>
        {member.status === 'trial' && <div className="mt-3"><Badge tone="warn">{t('试工')}</Badge></div>}
      </div>

      {/* 下一个班 */}
      {next ? (
        <section className="flex flex-wrap items-stretch justify-between gap-6 rounded-[22px] bg-hero p-6 sm:p-7">
          <div className="min-w-0">
            <p className="flex flex-wrap items-baseline gap-x-2 text-sm text-ink-2"><span className="num font-semibold text-ink">/next</span>{dayName(next.day)} · {dayLabel(weekdayIdx(next.day))} {fmtDay(next.day)}</p>
            <p className="num mt-3 text-[clamp(1.9rem,4vw,3rem)] font-semibold leading-none tracking-tight">{fmtMin(next.rangeStart)} – {fmtMin(next.rangeEnd)}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {next.shifts.map((s) => {
                const p = s.position_id ? posOf.get(s.position_id) : undefined
                return <span key={s.id} style={roleStyle(p?.color)} className="num rounded-full border px-3 py-1 text-xs font-semibold">{p?.name ?? t('未指定岗位')} {fmtMin(s.start_min)}–{fmtMin(s.end_min)}</span>
              })}
            </div>
          </div>
          <div className="flex flex-col items-end justify-between">
            <span className="rounded-full border border-ink/40 px-3 py-0.5 text-xs font-semibold">{next.inProgress ? t('进行中') : t('还有')}</span>
            <p className="num text-[clamp(1.9rem,4vw,3rem)] font-semibold leading-none tracking-tight text-accent">{fmtDur(next.minutes)}{next.inProgress && <span className="ml-2 text-sm font-medium text-ink-2">{t('后结束')}</span>}</p>
          </div>
        </section>
      ) : (
        <section className="flex flex-wrap items-center justify-between gap-5 rounded-[22px] border border-dashed border-line-strong p-6 sm:p-7">
          <div className="max-w-[34rem]">
            <p className="text-lg font-semibold">{t('接下来还没有你的班次')}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-mute">{t('可能店长还没有发布这周的班表。发布之前，先把你能上班的时间告诉店长吧。')}</p>
          </div>
          <Button variant="primary" onClick={() => setTab('avail')}>{t('填写可用时间')}<ArrowRight size={16} /></Button>
        </section>
      )}

      {/* 左栏：统计 + 提醒 + 账号 */}
      <aside className="flex flex-col gap-4">
        <div className="rounded-[22px] border border-line bg-surface p-5">
          <Segmented size="sm" value={range} onChange={setRange} options={[{ value: 'week', label: t('周') }, { value: 'biweek', label: t('双周') }, { value: 'month', label: t('月') }]} />
          <p className="num mt-4 text-xs text-mute">{fmtRangeShort(from, to)}</p>
          <p className="num mt-1 flex items-baseline gap-1.5 font-display text-6xl font-extrabold leading-none tracking-[-0.04em]">{fmtHours(totalMin)}<span className="font-sans text-base font-medium tracking-normal text-mute">{t('小时')}</span></p>
          <p className="mt-2 text-sm text-ink-2">{t('{n} 个班次，{d} 天上班', { n: statShifts.length, d: daysWorked })}</p>
          <div className="mt-4 border-t border-line pt-4">
            <Button className="w-full" onClick={exportIcs}><DownloadSimple size={16} />{t('导出到日历')}</Button>
            <p className="mt-2.5 text-xs leading-relaxed text-mute">{t('下载 .ics 文件，Google、Apple、Outlook 日历都能导入。')}</p>
          </div>
        </div>

        {nextWeekFilled === false && (
          <div className="rounded-[22px] bg-warn-soft p-5">
            <p className="text-sm font-semibold text-warn">{t('下周可用时间还没填')}</p>
            <p className="num mt-1 text-xs text-warn">{fmtRangeShort(nextWeek, addDays(nextWeek, 6))}</p>
            <Button variant="primary" size="sm" className="mt-3" onClick={() => setTab('avail')}>{t('去填写')}</Button>
          </div>
        )}

        <div className="px-1"><AccountLinks shopName={shop.name} /></div>
      </aside>

      <main className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Segmented value={tab} onChange={setTab} options={[{ value: 'schedule', label: t('我的班表') }, { value: 'avail', label: t('填写可用时间') }]} />
          {tab === 'schedule' && (
            <div className="flex items-center gap-3">
              <RoundBtn label={t('上一周')} onClick={() => setWeek(addDays(week, -7))}><CaretLeft size={16} /></RoundBtn>
              <span className="num min-w-[9.5rem] text-center text-base font-semibold">{fmtRangeShort(week, addDays(week, 6))}</span>
              <RoundBtn label={t('下一周')} onClick={() => setWeek(addDays(week, 7))}><CaretRight size={16} /></RoundBtn>
            </div>
          )}
        </div>

        {tab === 'schedule'
          ? <WeekSchedule shop={shop} week={week} shifts={weekShifts} posOf={posOf} locations={locations} tasks={tasks} today={today} />
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
function WeekSchedule({ shop, week, shifts, posOf, locations, tasks, today }: {
  shop: Shop; week: string; shifts: Shift[] | null; posOf: Map<string, Position>; locations: Location[]; tasks: DailyTask[]; today: string
}) {
  const locName = new Map(locations.map((l) => [l.id, l.name]))
  const multi = locations.length > 1
  const days = weekDays(week)
  const open = shop.hours.filter(Boolean) as { open: number; close: number }[]
  const axisMin = open.length ? Math.min(...open.map((h) => h.open)) : 540
  const axisMax = open.length ? Math.max(...open.map((h) => h.close)) : 1320
  const span = axisMax - axisMin
  const hourLines: number[] = []
  for (let m = Math.ceil(axisMin / 60) * 60; m <= axisMax; m += 60) hourLines.push(m)
  const labels = hourLines.filter((m) => (m / 60) % 2 === 0)
  const pos = (m: number) => `${((m - axisMin) / span) * 100}%`

  if (shifts === null) return <div className="flex flex-col gap-2">{Array.from({ length: 7 }, (_, i) => <Skeleton key={i} className="h-14" />)}</div>
  const anyShift = shifts.length > 0

  return (
    <div className="rounded-[22px] border border-line bg-surface p-3 sm:p-5">
      <div className="relative mb-2 ml-[88px] h-4 text-[11px] text-mute num" aria-hidden>
        {labels.map((m) => <span key={m} className="absolute -translate-x-1/2" style={{ left: pos(m) }}>{fmtMin(m)}</span>)}
      </div>
      <div className="flex flex-col gap-1">
        {days.map((day) => {
          const list = shifts.filter((s) => s.day === day)
          const isToday = day === today
          const h = shop.hours[weekdayIdx(day)]
          const hol = holidayOn(day, shop.region)
          return (
            <div key={day} className={cn('flex items-stretch gap-3 rounded-2xl px-3 py-2', isToday ? 'bg-accent-soft' : 'border-b border-line last:border-b-0')}>
              <div className="w-[64px] shrink-0 self-center">
                <p className={cn('text-sm font-semibold leading-tight', isToday && 'text-accent')}>{dayLabel(weekdayIdx(day))}{isToday && <span className="ml-1 text-[11px]">· {t('今天')}</span>}</p>
                <p className="num text-xs text-mute">{fmtDay(day)}</p>
                {hol && <p className="mt-0.5 text-[11px] font-medium text-warn" title={holidayLabel(hol)}>{holidayName(hol)}</p>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="relative h-11">
                  {hourLines.map((m) => <div key={m} className="absolute inset-y-0 w-px bg-line" style={{ left: pos(m) }} />)}
                  {!h && <span className="absolute inset-y-0 left-2 flex items-center text-xs text-faint">{t('店铺休息')}</span>}
                  {h && !list.length && anyShift && <span className="absolute inset-y-0 left-2 flex items-center text-xs text-faint">{t('休息')}</span>}
                  {list.map((s) => {
                    const p = s.position_id ? posOf.get(s.position_id) : undefined
                    return (
                      <div key={s.id} title={`${fmtMin(s.start_min)} - ${fmtMin(s.end_min)}`} style={{ ...roleStyle(p?.color), left: pos(s.start_min), width: `${((s.end_min - s.start_min) / span) * 100}%` }}
                        className="absolute inset-y-1 flex items-center overflow-hidden rounded-full border px-3 text-xs font-semibold">
                        <span className="num truncate">{p ? `${p.name} ` : ''}{fmtMin(s.start_min)}–{fmtMin(s.end_min)}{multi ? ` @${locName.get(s.location_id) ?? ''}` : ''}</span>
                      </div>
                    )
                  })}
                </div>
                {list.filter((s) => s.note).map((s) => <p key={s.id} className="mt-1 text-xs text-mute">{t('备注：')}{s.note}</p>)}
                {/* 当日任务：只显示我上班的那几家门店的 */}
                {tasks.filter((k) => k.day === day && list.some((s) => s.location_id === k.location_id)).map((k) => (
                  <p key={k.location_id} className="mt-1 whitespace-pre-line rounded-xl bg-warn-soft px-3 py-1.5 text-xs text-warn">
                    <strong className="font-semibold">{multi ? t('当日任务（{loc}）：', { loc: locName.get(k.location_id) ?? '' }) : t('当日任务：')}</strong>{k.text}
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
