import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, FilePdf } from '@phosphor-icons/react'
import { Button, Skeleton, useToast } from '../../components/ui'
import { useManager } from './ManagerLayout'
import { api } from '../../data'
import { errMsg } from '../../lib/errors'
import type { Member, Position, Shift } from '../../lib/types'
import { addDays, fmtDay, fmtMin, todayISO, weekDays, weekStart, weekdayIdx } from '../../lib/time'

const CN_DAY = ['一', '二', '三', '四', '五', '六', '日']
// 打印版固定使用浅色，不跟随系统深色模式，保证导出的 PDF 在任何电脑上一致
const INK = '#111827'
const LINE = '#9ca3af'

export default function PrintPage() {
  const { shop, positions, members } = useManager()
  const toast = useToast()
  const [params] = useSearchParams()
  const week = weekStart(params.get('week') ?? todayISO())
  const [shifts, setShifts] = useState<Shift[] | null>(null)
  const days = useMemo(() => weekDays(week), [week])

  useEffect(() => {
    api.listShifts(shop.id, week, addDays(week, 6)).then(setShifts).catch((e) => { toast(errMsg(e)); setShifts([]) })
  }, [shop.id, week, toast])

  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m])), [members])
  const posOrder = useMemo(() => new Map(positions.map((p, i) => [p.id, i])), [positions])
  const posMap = useMemo(() => new Map(positions.map((p) => [p.id, p])), [positions])

  return (
    <div>
      <div className="mx-auto mb-5 flex max-w-[820px] flex-wrap items-center justify-between gap-3 print:hidden">
        <Link to="/manager"><Button variant="ghost" size="sm"><ArrowLeft size={16} />返回排班</Button></Link>
        <div className="flex items-center gap-3">
          <p className="hidden text-xs text-mute sm:block">在打印窗口里，目标打印机选择"另存为 PDF"</p>
          <Button variant="primary" onClick={() => window.print()} disabled={!shifts}><FilePdf size={16} />导出 PDF</Button>
        </div>
      </div>

      {shifts === null ? (
        <div className="mx-auto max-w-[820px]"><Skeleton className="h-96" /></div>
      ) : (
        <div className="mx-auto max-w-[820px] bg-white p-6 shadow-sm print:max-w-none print:p-0 print:shadow-none" style={{ color: INK, printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
          <h1 className="mb-1 text-xl font-bold">{shop.name} 班表</h1>
          <p className="mb-5 text-sm" style={{ color: '#4b5563' }}>{fmtDay(days[0])} - {fmtDay(days[6])}</p>
          {days.map((day) => (
            <DaySheet key={day} day={day} closed={!shop.hours[weekdayIdx(day)]} shifts={shifts.filter((s) => s.day === day)}
              memberMap={memberMap} posMap={posMap} posOrder={posOrder} />
          ))}
        </div>
      )}
    </div>
  )
}

function DaySheet({ day, closed, shifts, memberMap, posMap, posOrder }: {
  day: string; closed: boolean; shifts: Shift[]; memberMap: Map<string, Member>; posMap: Map<string, Position>; posOrder: Map<string, number>
}) {
  const d = new Date(day + 'T00:00:00')
  const sorted = [...shifts].sort((a, b) =>
    (posOrder.get(a.position_id ?? '') ?? 99) - (posOrder.get(b.position_id ?? '') ?? 99) || a.start_min - b.start_min)
  const regular = sorted.filter((s) => memberMap.get(s.member_id)?.status !== 'trial')
  const trial = sorted.filter((s) => memberMap.get(s.member_id)?.status === 'trial')

  return (
    <section className="mb-6 break-inside-avoid">
      <h2 className="px-3 py-1.5 text-lg font-bold" style={{ background: '#e5e7eb' }}>
        星期{CN_DAY[weekdayIdx(day)]} <span className="num">{d.getMonth() + 1}/{d.getDate()}</span>
      </h2>
      {closed ? <p className="px-3 py-3 text-sm" style={{ color: '#6b7280' }}>休息</p>
        : shifts.length === 0 ? <p className="px-3 py-3 text-sm" style={{ color: '#6b7280' }}>暂无排班</p>
        : (
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr style={{ background: '#f3f4f6' }}>
                {['序号 NO.', '姓名 Name', '上班 Start', '下班 End', '岗位 Positions'].map((h, i) => (
                  <th key={h} className="px-2 py-1 text-center font-semibold" style={{ border: `1px solid ${LINE}`, width: i === 0 ? '12%' : undefined }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <Rows list={regular} memberMap={memberMap} posMap={posMap} />
              {trial.length > 0 && (
                <>
                  <tr><td colSpan={5} className="px-2 py-1 text-center font-semibold" style={{ background: '#fde2d4', border: `1px solid ${LINE}` }}>Training 试工</td></tr>
                  <Rows list={trial} memberMap={memberMap} posMap={posMap} />
                </>
              )}
            </tbody>
          </table>
        )}
    </section>
  )
}

function Rows({ list, memberMap, posMap }: { list: Shift[]; memberMap: Map<string, Member>; posMap: Map<string, Position> }) {
  const cell = { border: `1px solid ${LINE}` }
  return (
    <>
      {list.map((s, i) => {
        const p = s.position_id ? posMap.get(s.position_id) : undefined
        return (
          <tr key={s.id}>
            <td className="num px-2 py-1 text-center" style={cell}>{i + 1}</td>
            <td className="px-2 py-1 text-center font-medium" style={cell}>{memberMap.get(s.member_id)?.name ?? '-'}</td>
            <td className="num px-2 py-1 text-center" style={cell}>{fmtMin(s.start_min)}</td>
            <td className="num px-2 py-1 text-center" style={cell}>{fmtMin(s.end_min)}</td>
            <td className="px-2 py-1 text-center" style={cell}>
              {p ? <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />{p.name}</span> : ''}
              {s.note && <span className="ml-2 text-[11px]" style={{ color: '#6b7280' }}>{s.note}</span>}
            </td>
          </tr>
        )
      })}
    </>
  )
}
