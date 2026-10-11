import { ROLE_PRINT, roleOf } from '../../lib/roles'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, FilePdf } from '@phosphor-icons/react'
import { Button, Segmented, Select, Skeleton, useToast } from '../../components/ui'
import { useManager } from './ManagerLayout'
import { api } from '../../data'
import { errMsg } from '../../lib/errors'
import { holidayLabel, holidayOn } from '../../lib/holidays'
import { getLang, translate as tr } from '../../i18n/core'
import type { DailyTask, Location, Member, PdfStyle, Position, Shift, Shop } from '../../lib/types'
import { addDays, fmtDay, fmtHours, fmtMin, todayISO, weekDays, weekStart, weekdayIdx } from '../../lib/time'
import { totalMinutes, trainingMinutes } from '../../lib/training'

const CN_DAY = ['一', '二', '三', '四', '五', '六', '日']
const EN_DAY = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const weekdayName = (i: number) => (getLang() === 'zh' ? `星期${CN_DAY[i]}` : EN_DAY[i])
// 打印版固定使用浅色，不跟随系统深色模式，保证导出的 PDF 在任何电脑上一致
const INK = '#111827'
const LINE = '#9ca3af'
const MUTED = '#6b7280'
const DAY_BG = ['#e5e7eb', '#fde2d4', '#fef3c7', '#dcfce7', '#dbeafe', '#ede9fe', '#fce7f3'] // 与星期对应的淡色，时间条样式用

interface Ctx {
  shop: Shop
  memberMap: Map<string, Member>
  posMap: Map<string, Position>
  posOrder: Map<string, number>
}

export default function PrintPage() {
  const { shop, locations, positions, members } = useManager()
  const toast = useToast()
  const [params] = useSearchParams()
  const week = weekStart(params.get('week') ?? todayISO(), shop.week_start)
  const [style, setStyle] = useState<PdfStyle>((params.get('style') as PdfStyle | null) ?? shop.pdf_style)
  const [locSel, setLocSel] = useState(params.get('loc') ?? 'all')
  const [shifts, setShifts] = useState<Shift[] | null>(null)
  const [tasks, setTasks] = useState<DailyTask[]>([])
  const days = useMemo(() => weekDays(week), [week])

  useEffect(() => {
    const to = addDays(week, 6)
    Promise.all([api.listShifts(shop.id, week, to), api.listDailyTasks(shop.id, week, to)])
      .then(([s, t]) => { setShifts(s); setTasks(t) })
      .catch((e) => { toast(errMsg(e)); setShifts([]) })
  }, [shop.id, week, toast])

  const ctx: Ctx = useMemo(() => ({
    shop,
    memberMap: new Map(members.map((m) => [m.id, m])),
    posMap: new Map(positions.map((p) => [p.id, p])),
    posOrder: new Map(positions.map((p, i) => [p.id, i])),
  }), [shop, members, positions])

  const shown: Location[] = locSel === 'all' ? locations : locations.filter((l) => l.id === locSel)
  const timeline = style === 'timeline'

  return (
    <div>
      {/* 时间条样式更宽，用横向 A4 */}
      <style>{timeline ? '@page { size: A4 landscape; margin: 10mm; }' : '@page { size: A4; margin: 12mm; }'}</style>

      <div className="mx-auto mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden" style={{ maxWidth: timeline ? 1100 : 820 }}>
        <Link to="/manager"><Button variant="ghost" size="sm"><ArrowLeft size={16} />{tr('返回排班')}</Button></Link>
        <div className="flex flex-wrap items-center gap-3">
          <Segmented size="sm" value={style} onChange={setStyle} options={[{ value: 'table', label: tr('表格') }, { value: 'timeline', label: tr('时间条') }]} />
          {locations.length > 1 && (
            <Select value={locSel} onChange={(e) => setLocSel(e.target.value)} style={{ width: 150 }} className="h-8 text-[13px]" aria-label={tr('选择门店')}>
              <option value="all">{tr('全部门店')}</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </Select>
          )}
          <Button variant="primary" onClick={() => window.print()} disabled={!shifts}><FilePdf size={16} />{tr('导出 PDF')}</Button>
        </div>
        <p className="w-full text-right text-xs text-mute">{tr('点"导出 PDF"后，在打印窗口里把打印机选成"另存为 PDF"。')}</p>
      </div>

      {shifts === null ? (
        <div className="mx-auto max-w-[820px]"><Skeleton className="h-96" /></div>
      ) : (
        <div className="mx-auto" style={{ maxWidth: timeline ? 1100 : 820 }}>
          {shown.map((l, i) => (
            <div key={l.id} className={`bg-white p-6 shadow-sm print:p-0 print:shadow-none ${i > 0 ? 'mt-6 print:mt-0 print:break-before-page' : ''}`}
              style={{ color: INK, printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
              <h1 className="mb-1 text-xl font-bold">{locations.length > 1 && l.name !== shop.name ? `${shop.name} · ${l.name}` : shop.name} {tr('班表')}</h1>
              <p className="mb-5 text-sm" style={{ color: '#4b5563' }}>{fmtDay(days[0])} - {fmtDay(days[6])}</p>
              {timeline
                ? <TimelineSheet days={days} ctx={ctx} shifts={shifts.filter((s) => s.location_id === l.id)} tasks={tasks.filter((k) => k.location_id === l.id)} />
                : days.map((day) => (
                  <TableDay key={day} day={day} ctx={ctx} shifts={shifts.filter((s) => s.location_id === l.id && s.day === day)} task={tasks.find((k) => k.location_id === l.id && k.day === day)?.text} />
                ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ============================ 表格样式 ============================ */

function sortShifts(list: Shift[], ctx: Ctx) {
  return [...list].sort((a, b) => (ctx.posOrder.get(a.position_id ?? '') ?? 99) - (ctx.posOrder.get(b.position_id ?? '') ?? 99) || a.start_min - b.start_min)
}
const total = totalMinutes
const TRAIN_BG = '#ede9fe'

function TableDay({ day, ctx, shifts, task }: { day: string; ctx: Ctx; shifts: Shift[]; task?: string }) {
  const d = new Date(day + 'T00:00:00')
  const closed = !ctx.shop.hours[weekdayIdx(day)]
  const sorted = sortShifts(shifts, ctx)
  // 分三组：正式班次、试工员工的班次、培训班次（排进了自己不会的岗位）
  const training = sorted.filter((s) => s.training)
  const regular = sorted.filter((s) => !s.training && ctx.memberMap.get(s.member_id)?.status !== 'trial')
  const trial = sorted.filter((s) => !s.training && ctx.memberMap.get(s.member_id)?.status === 'trial')
  const trainMin = trainingMinutes(shifts)
  const hol = holidayOn(day, ctx.shop.region)

  return (
    <section className="mb-6 break-inside-avoid">
      <h2 className="flex flex-wrap items-baseline gap-x-3 px-3 py-1.5 text-lg font-bold" style={{ background: '#e5e7eb' }}>
        <span>{weekdayName(weekdayIdx(day))} <span className="num">{d.getMonth() + 1}/{d.getDate()}</span></span>
        {hol && <span className="text-[13px] font-semibold" style={{ color: '#b45309' }}>{tr('法定假日')} {holidayLabel(hol)}</span>}
        {shifts.length > 0 && (
          <span className="num ml-auto text-[13px] font-normal" style={{ color: '#4b5563' }}>
            {tr('共 {h} 小时', { h: fmtHours(total(shifts)) })}
            {trainMin > 0 && <span className="ml-3">{tr('其中培训 {h} 小时', { h: fmtHours(trainMin) })}</span>}
          </span>
        )}
      </h2>
      {closed ? <p className="px-3 py-3 text-sm" style={{ color: MUTED }}>{tr('休息')}</p>
        : shifts.length === 0 ? <p className="px-3 py-3 text-sm" style={{ color: MUTED }}>{tr('暂无排班')}</p>
        : (
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr style={{ background: '#f3f4f6' }}>
                {['序号 NO.', '姓名 Name', '上班 Start', '下班 End', '岗位 Positions'].map((h, i) => (
                  <th key={h} className="px-2 py-1 text-center font-semibold" style={{ border: `1px solid ${LINE}`, width: i === 0 ? '12%' : undefined }}>{tr(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <Rows list={regular} ctx={ctx} />
              {trial.length > 0 && (
                <>
                  <tr><td colSpan={5} className="px-2 py-1 text-center font-semibold" style={{ background: '#fde2d4', border: `1px solid ${LINE}` }}>{tr('Trial 试工')}</td></tr>
                  <Rows list={trial} ctx={ctx} />
                </>
              )}
              {training.length > 0 && (
                <>
                  <tr><td colSpan={5} className="px-2 py-1 text-center font-semibold" style={{ background: TRAIN_BG, border: `1px solid ${LINE}` }}>{tr('Training 培训')}</td></tr>
                  <Rows list={training} ctx={ctx} markTrial />
                </>
              )}
            </tbody>
          </table>
        )}
      {task && (
        <p className="whitespace-pre-line px-3 py-2 text-[13px]" style={{ background: '#fef3c7', border: `1px solid ${LINE}`, borderTop: 0 }}>
          <strong>{tr('DAILY TASK 当日任务：')}</strong>{task}
        </p>
      )}
    </section>
  )
}

function Rows({ list, ctx, markTrial = false }: { list: Shift[]; ctx: Ctx; markTrial?: boolean }) {
  const cell = { border: `1px solid ${LINE}` }
  return (
    <>
      {list.map((s, i) => {
        const p = s.position_id ? ctx.posMap.get(s.position_id) : undefined
        return (
          <tr key={s.id}>
            <td className="num px-2 py-1 text-center" style={cell}>{i + 1}</td>
            <td className="px-2 py-1 text-center font-medium" style={cell}>
              {ctx.memberMap.get(s.member_id)?.name ?? '-'}
              {markTrial && ctx.memberMap.get(s.member_id)?.status === 'trial' && <span className="ml-1 text-[11px] font-normal" style={{ color: MUTED }}>({tr('试工')})</span>}
            </td>
            <td className="num px-2 py-1 text-center" style={cell}>{fmtMin(s.start_min)}</td>
            <td className="num px-2 py-1 text-center" style={cell}>{fmtMin(s.end_min)}</td>
            <td className="px-2 py-1 text-center" style={cell}>
              {p ? <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: ROLE_PRINT[roleOf(p.color)].border }} />{p.name}</span> : ''}
              {s.note && <span className="ml-2 text-[11px]" style={{ color: MUTED }}>{s.note}</span>}
            </td>
          </tr>
        )
      })}
    </>
  )
}

/* ============================ 时间条样式 ============================ */

function TimelineSheet({ days, ctx, shifts, tasks }: { days: string[]; ctx: Ctx; shifts: Shift[]; tasks: DailyTask[] }) {
  // 横轴范围：这一周营业时间的最早开门到最晚关门，取整点
  const opens = ctx.shop.hours.filter(Boolean) as { open: number; close: number }[]
  const lo = Math.floor(Math.min(...opens.map((h) => h.open), ...shifts.map((s) => s.start_min), 24 * 60) / 60) * 60
  const hi = Math.ceil(Math.max(...opens.map((h) => h.close), ...shifts.map((s) => s.end_min), 0) / 60) * 60
  const span = Math.max(60, hi - lo)
  const hourCount = span / 60
  const ticks = Array.from({ length: hourCount + 1 }, (_, i) => lo / 60 + i)
  const grid = `repeating-linear-gradient(to right, #d1d5db 0 1px, transparent 1px ${100 / hourCount}%)`
  const cell = { border: `1px solid ${LINE}` }

  return (
    <table className="w-full border-collapse text-[12px]" style={{ tableLayout: 'fixed' }}>
      <colgroup>
        <col style={{ width: 96 }} /><col style={{ width: 92 }} /><col style={{ width: 62 }} /><col style={{ width: 150 }} /><col style={{ width: 96 }} /><col />
      </colgroup>
      <thead>
        <tr style={{ background: '#111827', color: '#fff' }}>
          {['日期 DATE', '姓名 NAME', '状态', '备注 NOTE', '时段 TIME SLOT'].map((h) => <th key={h} className="px-1 py-1 text-center font-semibold" style={cell}>{tr(h)}</th>)}
          <th className="relative p-0" style={{ ...cell, height: 24 }}>
            {ticks.map((h, i) => <span key={h} className="num absolute top-1 text-[11px]" style={{ left: `${(i / hourCount) * 100}%`, transform: i === 0 ? 'none' : i === hourCount ? 'translateX(-100%)' : 'translateX(-50%)' }}>{h % 24}</span>)}
          </th>
        </tr>
      </thead>
      {days.map((day) => {
        const idx = weekdayIdx(day)
        const list = [...shifts.filter((s) => s.day === day)].sort((a, b) => Number(a.training) - Number(b.training) || a.start_min - b.start_min || (ctx.posOrder.get(a.position_id ?? '') ?? 99) - (ctx.posOrder.get(b.position_id ?? '') ?? 99))
        const trainMin = trainingMinutes(list)
        const closed = !ctx.shop.hours[idx]
        const task = tasks.find((t) => t.day === day)?.text
        const hol = holidayOn(day, ctx.shop.region)
        const d = new Date(day + 'T00:00:00')
        const rowCount = Math.max(1, list.length) + (task ? 1 : 0) + 1
        return (
          <tbody key={day} style={{ breakInside: 'avoid' }}>
            {(list.length ? list : [null]).map((s, i) => {
              const m = s && ctx.memberMap.get(s.member_id)
              const p = s?.position_id ? ctx.posMap.get(s.position_id) : undefined
              return (
                <tr key={s?.id ?? 'empty'} style={{ height: 24 }}>
                  {i === 0 && (
                    <td rowSpan={rowCount} className="px-1 text-center align-middle" style={{ ...cell, background: DAY_BG[idx] }}>
                      <p className="text-[13px] font-bold">{weekdayName(idx)}</p>
                      <p className="num">{d.getMonth() + 1}/{d.getDate()}</p>
                      {hol && <p className="mt-1 text-[10px] font-semibold leading-tight" style={{ color: '#b45309' }}>{getLang() === 'zh' ? <>{hol.zh}<br />{hol.en}</> : hol.en}</p>}
                    </td>
                  )}
                  {s && m ? (
                    <>
                      <td className="truncate px-2 font-semibold" style={cell}>{m.name}</td>
                      <td className="px-1 text-center" style={{ ...cell, background: s.training ? TRAIN_BG : m.status === 'trial' ? '#dbeafe' : undefined }}>{s.training ? tr('培训') : m.status === 'trial' ? tr('试工') : tr('正式')}</td>
                      <td className="truncate px-2" style={cell} title={s.note}>{s.note}</td>
                      <td className="num px-1 text-center" style={cell}>{fmtMin(s.start_min)}-{fmtMin(s.end_min)}</td>
                      <td className="relative p-0" style={{ ...cell, backgroundImage: grid }}>
                        <div className="absolute inset-y-[3px]" style={{ left: `${((s.start_min - lo) / span) * 100}%`, width: `${((s.end_min - s.start_min) / span) * 100}%`, background: s.training ? `repeating-linear-gradient(135deg, ${ROLE_PRINT[roleOf(p?.color)].border} 0 4px, #ffffff 4px 7px)` : ROLE_PRINT[roleOf(p?.color)].border, border: s.training ? `1px solid ${ROLE_PRINT[roleOf(p?.color)].border}` : undefined }} title={p?.name} />
                        {p && ((s.end_min - s.start_min) / span) > 0.1 && <span className="absolute inset-y-0 flex items-center px-1.5 text-[10px] font-semibold" style={{ left: `${((s.start_min - lo) / span) * 100}%`, color: s.training ? INK : '#ffffff' }}><span style={s.training ? { background: '#ffffff', padding: '0 3px' } : undefined}>{p.name}</span></span>}
                      </td>
                    </>
                  ) : (
                    <td colSpan={5} className="px-2 text-center" style={{ ...cell, color: MUTED }}>{closed ? tr('休息') : tr('暂无排班')}</td>
                  )}
                </tr>
              )
            })}
            {task && (
              <tr><td colSpan={5} className="whitespace-pre-line px-2 py-1" style={{ ...cell, background: '#fef3c7' }}><strong>{tr('DAILY TASK 当日任务：')}</strong>{task}</td></tr>
            )}
            <tr style={{ height: 20 }}>
              <td colSpan={3} className="px-2 text-right text-[11px]" style={{ ...cell, color: MUTED }}>{tr('合计 Total（小时）')}</td>
              <td className="num px-1 text-center font-semibold" style={{ ...cell, background: '#fff7ed' }}>{fmtHours(total(list))}</td>
              <td className="num px-2 text-[11px]" style={{ ...cell, background: trainMin > 0 ? TRAIN_BG : undefined }}>{trainMin > 0 ? tr('其中培训 {h} 小时', { h: fmtHours(trainMin) }) : ''}</td>
            </tr>
          </tbody>
        )
      })}
    </table>
  )
}
