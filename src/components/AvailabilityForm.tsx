import { useEffect, useMemo, useState } from 'react'
import { CaretLeft, CaretRight, CheckCircle, Plus, Sun, Trash } from '@phosphor-icons/react'
import { Button, Input, Skeleton, cn, useToast } from './ui'
import { holidayLabel, holidayName, holidayOn } from '../lib/holidays'
import { translate as t } from '../i18n/core'
import type { AvailEntry, WeekHours, WeekStartDay } from '../lib/types'
import { addDays, dayLabel, fmtDay, fmtMin, inputTime, isNextDay, mergeIntervals, parseEndAfter, parseStartIn, todayISO, weekDays, weekStart, weekdayIdx } from '../lib/time'
import type { Interval } from '../lib/time'
import { errMsg } from '../lib/errors'
import { validateWeek } from '../lib/availability'
import type { DayError } from '../lib/availability'

interface DayState { ranges: Interval[]; note: string; locs: string[] }
const EMPTY_DAY: DayState = { ranges: [], note: '', locs: [] }
type WeekState = Record<string, DayState>

interface Props {
  hours: WeekHours
  /** 店铺的门店列表；只有一家时不显示门店选项 */
  locations: { id: string; name: string }[]
  weekStartDay: WeekStartDay
  /** 法定假日地区，用来在日期旁提醒 */
  region: string
  /** 加载某一周已有的报班 */
  load: (weekStart: string) => Promise<AvailEntry[]>
  save: (weekStart: string, entries: AvailEntry[]) => Promise<void>
  /** 访客必须先填名字 */
  canSubmit: boolean
  /** 名字变化时重新载入 */
  reloadKey: string
  onSaved?: () => void
}

export function AvailabilityForm({ hours, locations, weekStartDay, region, load, save, canSubmit, reloadKey, onSaved }: Props) {
  const toast = useToast()
  const thisWeek = weekStart(todayISO(), weekStartDay)
  const [week, setWeek] = useState(thisWeek)
  const [state, setState] = useState<WeekState>({})
  const [loading, setLoading] = useState(true)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const days = useMemo(() => weekDays(week), [week])

  useEffect(() => {
    let alive = true
    setLoading(true); setDirty(false); setSaved(false); setErrors({})
    load(week).then((entries) => {
      if (!alive) return
      const next: WeekState = {}
      for (const d of weekDays(week)) next[d] = { ranges: [], note: '', locs: [] }
      for (const e of entries) {
        const day = next[e.day]; if (!day) continue
        day.ranges.push([e.start, e.end]); if (e.note) day.note = e.note
        if (e.locations?.length) day.locs = e.locations
      }
      setState(next); setLoading(false)
    }).catch((e) => { if (alive) { toast(errMsg(e)); setLoading(false) } })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week, reloadKey])

  const patch = (day: string, fn: (d: DayState) => DayState) => {
    setState((s) => ({ ...s, [day]: fn(s[day] ?? EMPTY_DAY) })); setDirty(true); setSaved(false)
  }
  const go = (delta: number) => {
    if (dirty && !window.confirm(t('本周的修改还没有提交，确定要切换吗？'))) return
    setWeek((w) => addDays(w, delta * 7))
  }

  const submit = async () => {
    // 校验和生成记录的逻辑在 lib/availability.ts（有单元测试），这里只负责把错误翻译成文案
    const { errors: found, entries } = validateWeek(days, state, (d) => hours[weekdayIdx(d)])
    const text = (e: DayError) =>
      e.kind === 'closed' ? t('这天店铺休息')
        : e.kind === 'order' ? t('结束时间要晚于开始时间')
        : t('请在营业时间内填写（{a} - {b}）', { a: fmtMin(e.open), b: fmtMin(e.close) })
    const errs = Object.fromEntries(Object.entries(found).map(([d, e]) => [d, text(e)]))
    setErrors(errs)
    if (Object.keys(errs).length) { toast(t('有几天的时间需要修改')); return }
    setSaving(true)
    try { await save(week, entries); setDirty(false); setSaved(true); onSaved?.() } catch (e) { toast(errMsg(e)) } finally { setSaving(false) }
  }

  const weekLabel = `${fmtDay(days[0])} - ${fmtDay(days[6])}`

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button variant="secondary" size="sm" onClick={() => go(-1)} disabled={week <= thisWeek} aria-label={t('上一周')}><CaretLeft size={16} /></Button>
          <span className="num min-w-[9.5rem] text-center text-sm font-medium">{weekLabel}</span>
          <Button variant="secondary" size="sm" onClick={() => go(1)} aria-label={t('下一周')}><CaretRight size={16} /></Button>
          {week === thisWeek && <span className="ml-2 text-xs text-mute">{t('本周')}</span>}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {loading
          ? Array.from({ length: 7 }, (_, i) => <Skeleton key={i} className="h-[76px]" />)
          : days.map((day) => (
            <DayRow
              key={day} day={day} hours={hours[weekdayIdx(day)]} state={state[day] ?? EMPTY_DAY} locations={locations} region={region}
              error={errors[day]} past={day < todayISO()} onChange={(fn) => patch(day, fn)}
            />
          ))}
      </div>

      <div className="sticky bottom-0 -mx-4 mt-5 flex items-center justify-between gap-3 border-t border-line bg-bg/90 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-panel sm:border">
        <p className={cn('flex items-center gap-1.5 text-sm', saved ? 'text-avail' : 'text-mute')}>
          {saved ? <><CheckCircle size={18} weight="fill" />{t('已提交，店长可以看到了')}</> : dirty ? t('有未提交的修改') : t('修改后记得提交')}
        </p>
        <Button variant="primary" onClick={submit} disabled={saving || loading || !canSubmit}>{saving ? t('提交中...') : t('提交本周')}</Button>
      </div>
      {!canSubmit && <p className="mt-2 text-right text-xs text-mute">{t('先在上面填写名字才能提交')}</p>}
    </div>
  )
}

function DayRow({ day, hours, state, locations, region, error, past, onChange }: {
  day: string; hours: WeekHours[number]; state: DayState; locations: { id: string; name: string }[]; region: string; error?: string; past: boolean; onChange: (fn: (d: DayState) => DayState) => void
}) {
  const holiday = holidayOn(day, region)
  const idx = weekdayIdx(day)
  const closed = !hours
  const setRange = (i: number, which: 0 | 1, v: string) =>
    onChange((d) => ({ ...d, ranges: d.ranges.map((r, j) => (j === i ? (which === 0 ? [parseStartIn(v, hours?.open ?? 0, hours?.close), r[1]] : [r[0], parseEndAfter(v, r[0])]) : r) as Interval) }))
  const addRange = () => {
    if (!hours) return
    const last = state.ranges[state.ranges.length - 1]
    const start = last ? Math.min(last[1], hours.close - 60) : hours.open
    onChange((d) => ({ ...d, ranges: [...d.ranges, [start, Math.min(start + 240, hours.close)]] }))
  }
  const span = hours ? hours.close - hours.open : 1

  return (
    <div className={cn('grid gap-3 rounded-panel border bg-surface p-4 md:grid-cols-[112px_1fr]', error ? 'border-danger' : 'border-line', (past || closed) && 'opacity-60')}>
      <div>
        <p className="text-sm font-semibold">{dayLabel(idx)}{hours?.required && <span className="ml-1 text-xs font-medium text-warn">{t('（必选）')}</span>}</p>
        <p className="num text-xs text-mute">{fmtDay(day)}</p>
        {hours && <p className="num mt-1 text-[11px] text-faint">{fmtMin(hours.open)} - {fmtMin(hours.close)}</p>}
        {holiday && <p className="mt-1 text-[11px] font-medium text-warn" title={holidayLabel(holiday)}>{holidayName(holiday)}</p>}
      </div>
      {closed ? (
        <p className="self-center text-sm text-mute">{t('店铺休息')}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {/* 时间条：一眼看出这天填了哪些时段 */}
          <div className="relative h-2 overflow-hidden rounded-full bg-sunken" aria-hidden>
            {state.ranges.map(([a, b], i) => (
              <div key={i} className="absolute inset-y-0 rounded-full bg-avail/80" style={{ left: `${Math.max(0, ((a - hours!.open) / span) * 100)}%`, width: `${Math.max(0, ((b - a) / span) * 100)}%` }} />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {state.ranges.map(([a, b], i) => (
              <div key={i} className="flex items-center gap-1.5 rounded-control border border-line bg-bg px-1.5 py-1">
                {isNextDay(a) && <span className="text-[10px] font-medium text-warn">{t('次日')}</span>}
                <input type="time" step={900} value={inputTime(a)} onChange={(e) => e.target.value && setRange(i, 0, e.target.value)} aria-label={t('开始时间')} className="num h-7 w-[86px] bg-transparent text-sm focus:outline-none" />
                <span className="text-faint">-</span>
                <input type="time" step={900} value={inputTime(b)} onChange={(e) => e.target.value && setRange(i, 1, e.target.value)} aria-label={t('结束时间')} className="num h-7 w-[86px] bg-transparent text-sm focus:outline-none" />
                {isNextDay(b) && <span className="text-[10px] font-medium text-warn">{t('次日')}</span>}
                <button onClick={() => onChange((d) => ({ ...d, ranges: d.ranges.filter((_, j) => j !== i) }))} aria-label={t('删除时段')} className="press rounded p-1 text-faint hover:text-danger"><Trash size={15} /></button>
              </div>
            ))}
            <Button size="sm" variant="secondary" onClick={() => onChange((d) => ({ ...d, ranges: [[hours!.open, hours!.close]] }))}><Sun size={15} />{t('全天')}</Button>
            <Button size="sm" variant="ghost" onClick={addRange}><Plus size={15} />{state.ranges.length ? t('再加一段') : t('选时段')}</Button>
          </div>
          {state.ranges.length > 0 && locations.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t('可上班的门店')}>
              <span className="mr-1 text-xs text-mute">{t('可去的门店')}</span>
              {locations.map((l) => {
                const on = state.locs.includes(l.id)
                return (
                  <button key={l.id} type="button" aria-pressed={on}
                    onClick={() => onChange((d) => ({ ...d, locs: on ? d.locs.filter((x) => x !== l.id) : [...d.locs, l.id] }))}
                    className={cn('press h-7 rounded-full border px-2.5 text-xs font-medium', on ? 'border-transparent bg-accent text-accent-ink' : 'border-line text-mute hover:bg-sunken')}>
                    {l.name}
                  </button>
                )
              })}
              <span className="text-xs text-faint">{state.locs.length === 0 ? t('没选 = 哪家都可以') : ''}</span>
            </div>
          )}
          {state.ranges.length > 0 && (
            <Input value={state.note} onChange={(e) => onChange((d) => ({ ...d, note: e.target.value }))} placeholder={t('备注，例如：下午有课，最好排晚班')} maxLength={200} aria-label={t('备注')} className="h-9" />
          )}
          {error && <p className="text-xs text-danger" role="alert">{error}</p>}
        </div>
      )}
    </div>
  )
}
