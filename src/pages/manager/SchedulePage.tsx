import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CaretLeft, CaretRight, CheckCircle, Flag } from '@phosphor-icons/react'
import { Badge, Button, Empty, Segmented, Skeleton, cn, useToast } from '../../components/ui'
import { DayTimeline } from '../../components/DayTimeline'
import { useManager } from './ManagerLayout'
import { api } from '../../data'
import { errMsg } from '../../lib/errors'
import { holidayLabel, holidayOn } from '../../lib/holidays'
import { translate as t } from '../../i18n/core'
import { roleDot, roleStyle } from '../../lib/roles'
import { isTraining, trainingMinutes } from '../../lib/training'
import type { Availability, DailyTask, Shift, ShiftInput } from '../../lib/types'
import { addDays, dayLabel, fmtDay, fmtHours, fmtMD, fmtRangeShort, todayISO, weekDays, weekStart, weekdayIdx } from '../../lib/time'

export default function SchedulePage() {
  const { shop, locations, positions, members, skills } = useManager()
  const toast = useToast()
  const wsd = shop.week_start
  const [week, setWeek] = useState(weekStart(todayISO(), wsd))
  const [day, setDay] = useState(todayISO())
  const [shifts, setShifts] = useState<Shift[] | null>(null)
  const [avail, setAvail] = useState<Availability[]>([])
  const [tasks, setTasks] = useState<DailyTask[]>([])
  const [published, setPublished] = useState<string[]>([])
  const [brush, setBrush] = useState<string | null>(null)
  const [locId, setLocId] = useState<string | null>(() => { try { return localStorage.getItem(`shift-loc-${shop.id}`) } catch { return null } })
  const days = useMemo(() => weekDays(week), [week])
  const loc = locations.find((l) => l.id === locId) ?? locations[0]

  useEffect(() => { if (!brush && positions[0]) setBrush(positions[0].id); if (brush && !positions.some((p) => p.id === brush)) setBrush(positions[0]?.id ?? null) }, [positions, brush])
  useEffect(() => { api.listPublished(shop.id).then(setPublished).catch(() => {}) }, [shop.id])
  // 起始日改变后，回到包含"今天"的那一周
  useEffect(() => { setWeek(weekStart(todayISO(), wsd)); setDay(todayISO()) }, [wsd])
  useEffect(() => {
    let alive = true
    setShifts(null)
    const to = addDays(week, 6)
    Promise.all([api.listShifts(shop.id, week, to), api.listAvailability(shop.id, week, to), api.listDailyTasks(shop.id, week, to)])
      .then(([s, a, t]) => { if (alive) { setShifts(s); setAvail(a); setTasks(t) } })
      .catch((e) => { toast(errMsg(e)); if (alive) setShifts([]) })
    return () => { alive = false }
  }, [shop.id, week, toast])

  const pickLoc = (id: string) => { setLocId(id); try { localStorage.setItem(`shift-loc-${shop.id}`, id) } catch { /* ignore */ } }
  const changeWeek = (w: string) => {
    const idx = Math.max(0, days.indexOf(day))
    setWeek(w)
    const cur = weekDays(w)
    setDay(cur.includes(todayISO()) ? todayISO() : cur[idx])
  }

  const sortedMembers = useMemo(
    () => [...members].sort((a, b) => (a.status === b.status ? a.name.localeCompare(b.name, 'zh') : a.status === 'regular' ? -1 : 1)),
    [members],
  )
  const submitted = useMemo(() => new Set(avail.map((a) => a.member_id)), [avail])
  const locationNames = useMemo(() => new Map(locations.map((l) => [l.id, l.name])), [locations])
  const isPublished = published.includes(week)
  const hours = shop.hours[weekdayIdx(day)]
  const holiday = holidayOn(day, shop.region)

  /* ---------- 班次读写（乐观更新，失败回滚） ---------- */
  const reload = useCallback(async () => setShifts(await api.listShifts(shop.id, week, addDays(week, 6))), [shop.id, week])

  const create = async (input: ShiftInput) => {
    // 把员工排进他不会的岗位 = 培训（一个岗位都没勾过的员工无法判断，不算）
    const training = input.training ?? isTraining(skills.get(input.member_id), input.position_id)
    const tmp: Shift = { id: 'tmp-' + Math.random().toString(36).slice(2), shop_id: shop.id, note: '', ...input, training }
    setShifts((s) => [...(s ?? []), tmp])
    try {
      const real = await api.createShift(shop.id, { ...input, training })
      setShifts((s) => (s ?? []).map((x) => (x.id === tmp.id ? real : x)))
    } catch (e) { toast(errMsg(e)); reload() }
  }
  const update = async (id: string, patch: Partial<ShiftInput>) => {
    if (id.startsWith('tmp-')) return
    // 换了人或换了岗位，重新判断是不是培训；店长直接改"培训"开关时以店长为准
    if (patch.training === undefined && (patch.member_id !== undefined || patch.position_id !== undefined)) {
      const cur = (shifts ?? []).find((x) => x.id === id)
      if (cur) patch = { ...patch, training: isTraining(skills.get(patch.member_id ?? cur.member_id), patch.position_id !== undefined ? patch.position_id : cur.position_id) }
    }
    setShifts((s) => (s ?? []).map((x) => (x.id === id ? { ...x, ...patch } : x)))
    try { await api.updateShift(id, patch) } catch (e) { toast(errMsg(e)); reload() }
  }
  const remove = async (shift: Shift) => {
    if (shift.id.startsWith('tmp-')) return
    setShifts((s) => (s ?? []).filter((x) => x.id !== shift.id))
    try {
      await api.deleteShift(shift.id)
      toast(t('已删除班次'), {
        label: t('撤销'),
        run: async () => {
          const { id: _id, shop_id: _s, ...input } = shift
          try { const back = await api.createShift(shop.id, input); setShifts((s) => [...(s ?? []), back]) } catch (e) { toast(errMsg(e)) }
        },
      })
    } catch (e) { toast(errMsg(e)); reload() }
  }

  const togglePublish = async () => {
    const on = !isPublished
    try {
      await api.setPublished(shop.id, week, on)
      setPublished((p) => (on ? [...p, week] : p.filter((w) => w !== week)))
      toast(on ? t('已发布，员工登录后就能看到这一周的班表') : t('已撤回，员工暂时看不到这一周的班表'))
    } catch (e) { toast(errMsg(e)) }
  }

  /* ---------- 当日任务 ---------- */
  const taskText = tasks.find((t) => t.location_id === loc?.id && t.day === day)?.text ?? ''
  const [draft, setDraft] = useState(taskText)
  useEffect(() => { setDraft(taskText) }, [taskText, day, loc?.id])
  const saveTask = async () => {
    if (!loc || draft === taskText) return
    try {
      await api.setDailyTask(shop.id, loc.id, day, draft)
      setTasks((t) => [...t.filter((x) => !(x.location_id === loc.id && x.day === day)), ...(draft.trim() ? [{ shop_id: shop.id, location_id: loc.id, day, text: draft }] : [])])
    } catch (e) { toast(errMsg(e)) }
  }

  const locShifts = (shifts ?? []).filter((s) => s.location_id === loc?.id)
  const dayShifts = locShifts.filter((s) => s.day === day)
  const otherShifts = (shifts ?? []).filter((s) => s.day === day && s.location_id !== loc?.id)
  const dayAvail = avail.filter((a) => a.day === day && (a.location_ids.length === 0 || (loc && a.location_ids.includes(loc.id))))
  const weekMin = locShifts.reduce((n, s) => n + s.end_min - s.start_min, 0)
  const weekTrainMin = trainingMinutes(locShifts)

  if (members.length === 0) {
    return <Empty title={t('还没有员工')} hint={t('员工通过分享链接报班后会自动出现在这里，你也可以先手动添加。')} action={<Link to="/manager/staff"><Button variant="primary" size="sm">{t('去添加员工')}</Button></Link>} />
  }

  return (
    <div className="flex flex-col gap-5">
      {/* 周切换 + 发布 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => changeWeek(addDays(week, -7))} aria-label={t('上一周')} className="press grid h-11 w-11 place-items-center rounded-full border border-line-strong hover:bg-sunken"><CaretLeft size={16} /></button>
          <span className="num min-w-[10rem] text-center text-xl font-semibold tracking-tight">{fmtRangeShort(days[0], days[6])}</span>
          <button onClick={() => changeWeek(addDays(week, 7))} aria-label={t('下一周')} className="press grid h-11 w-11 place-items-center rounded-full border border-line-strong hover:bg-sunken"><CaretRight size={16} /></button>
          {week !== weekStart(todayISO(), wsd) && <Button size="sm" variant="ghost" onClick={() => changeWeek(weekStart(todayISO(), wsd))}>{t('回到本周')}</Button>}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="num hidden text-sm text-mute sm:inline">{locations.length > 1 ? t('{loc} {h} 小时', { loc: loc?.name ?? '', h: fmtHours(weekMin) }) : t('本周共 {h} 小时', { h: fmtHours(weekMin) })}{weekTrainMin > 0 && <span className="ml-2">{t('其中培训 {h} 小时', { h: fmtHours(weekTrainMin) })}</span>}</span>
          {isPublished ? <Badge tone="good">{t('已发布')}</Badge> : <Badge tone="warn">{t('草稿')}</Badge>}
          <Link to={`/manager/print?week=${week}`}><Button>{t('导出 PDF')}</Button></Link>
          <Button variant={isPublished ? 'secondary' : 'primary'} onClick={togglePublish}>
            {isPublished ? t('撤回发布') : <>{t('发布本周')}<ArrowRight size={16} /></>}
          </Button>
        </div>
      </div>

      {/* 多门店：切换正在排班的门店 */}
      {locations.length > 1 && loc && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-mute">{t('门店')}</span>
          <Segmented value={loc.id} onChange={pickLoc} options={locations.map((l) => ({ value: l.id, label: l.name }))} />
        </div>
      )}

      {/* 一周七天：以天为单位排班 */}
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2" role="tablist" aria-label={t('选择日期')}>
        {days.map((d) => {
          const h = shop.hours[weekdayIdx(d)]
          const n = locShifts.filter((s) => s.day === d).length
          const sel = d === day
          const hol = holidayOn(d, shop.region)
          return (
            <button key={d} role="tab" aria-selected={sel} onClick={() => setDay(d)} title={hol ? holidayLabel(hol) : undefined}
              className={cn('press relative flex flex-col items-center gap-0.5 rounded-2xl border px-1 py-3 text-center', sel ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface hover:bg-sunken', !h && !sel && 'opacity-55')}>
              <span className="text-sm font-semibold">{dayLabel(weekdayIdx(d))}</span>
              <span className="num text-[11px] text-mute">{fmtMD(d)}</span>
              <span className={cn('num text-[11px]', sel ? 'text-accent' : 'text-faint')}>{h ? (n ? t('{n} 个班', { n }) : t('未排')) : t('休息')}</span>
              {hol && <Flag size={12} weight="fill" className="absolute right-1 top-1 text-warn" aria-label={t('法定假日')} />}
            </button>
          )
        })}
      </div>

      {holiday && (
        <p className="flex items-start gap-2 rounded-2xl bg-warn-soft px-4 py-3 text-sm text-warn" role="note">
          <Flag size={16} weight="fill" className="mt-0.5 shrink-0" />
          <span>{t('{date}是法定假日：', { date: fmtDay(day) })}<strong className="font-semibold">{holidayLabel(holiday)}</strong>{t('。排班前请确认假日用工和工资规定。')}</span>
        </p>
      )}

      {/* 岗位画笔 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-mute">{t('新班次的岗位')}</span>
        {positions.map((p) => (
          <button key={p.id} onClick={() => setBrush(p.id)} aria-pressed={brush === p.id}
            className={cn('press flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-semibold', brush !== p.id && 'border-line bg-surface text-mute hover:bg-sunken')}
            style={brush === p.id ? roleStyle(p.color) : undefined}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: roleDot(p.color) }} />{p.name}
            {skills.size > 0 && <span className="num text-[11px] font-medium opacity-70" title={t('会这个岗位的人数')}>{members.filter((m) => skills.get(m.id)?.has(p.id)).length}</span>}
          </button>
        ))}
        {positions.length === 0 && <Link to="/manager/settings" className="text-sm font-medium text-accent">{t('先添加岗位标签')}</Link>}
      </div>

      {shifts === null || !loc ? (
        <Skeleton className="h-96" />
      ) : !hours ? (
        <Empty title={t('{day}店铺休息', { day: dayLabel(weekdayIdx(day)) })} hint={t('需要这天营业的话，到「设置」里修改营业时间。')} action={<Link to="/manager/settings"><Button size="sm">{t('去设置')}</Button></Link>} />
      ) : (
        <>
          <DayTimeline
            day={day} hours={hours} members={sortedMembers} positions={positions}
            shifts={dayShifts} otherShifts={otherShifts} locationNames={locationNames} avail={dayAvail} submitted={submitted} brushId={brush} skills={skills}
            onCreate={(input) => create({ ...input, location_id: loc.id })} onUpdate={update} onDelete={remove}
          />
          <section className="rounded-[22px] border border-line bg-surface p-5">
            <label htmlFor="daily-task" className="text-sm font-semibold">{t('当日任务 Daily Task')}</label>
            <p className="mt-0.5 text-xs text-mute">{locations.length > 1 ? t('这一天在「{loc}」上班的人都需要做的事，一行一件。发布后员工可见，也会印在导出的班表里。', { loc: loc.name }) : t('这一天上班的人都需要做的事，一行一件。发布后员工可见，也会印在导出的班表里。')}</p>
            <textarea id="daily-task" value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={saveTask} rows={3} maxLength={2000}
              placeholder={t('例如：盘点库存、擦窗户、关闭制冰机')}
              className="mt-2 w-full resize-y rounded-2xl border border-line-strong bg-bg px-4 py-3 text-sm placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25" />
          </section>
        </>
      )}
      {isPublished && shifts && <p className="flex items-center gap-1.5 text-xs text-mute"><CheckCircle size={14} className="text-avail" weight="fill" />{t('这一周已经发布，你现在的修改员工会立刻看到。')}</p>}
    </div>
  )
}
