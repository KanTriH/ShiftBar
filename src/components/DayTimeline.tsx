import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Trash, WarningCircle, X } from '@phosphor-icons/react'
import { Badge, Button, Input, cn } from './ui'
import type { Availability, DayHours, Member, Position, Shift, ShiftInput } from '../lib/types'
import { clamp, covers, fmtHours, fmtMin, mergeIntervals, parseHM, snap } from '../lib/time'

const NAME_W = 168
const ROW_H = 60
const COVER_H = 84
const MIN_LEN = 15
const NO_POS_COLOR = '#4b5563'

type Drag =
  | { kind: 'create'; memberId: string; anchor: number; start: number; end: number }
  | { kind: 'move' | 'resize-l' | 'resize-r'; shiftId: string; memberId: string; start: number; end: number; grab: number; orig: { start: number; end: number; memberId: string }; moved: boolean; x0: number; y0: number; rect: DOMRect }

interface Props {
  day: string
  hours: DayHours
  members: Member[]
  positions: Position[]
  shifts: Shift[]
  /** 同一天在其他门店的班次（只读，用来避免重复排班） */
  otherShifts: Shift[]
  locationNames: Map<string, string>
  avail: Availability[]
  /** 本周提交过报班的员工 */
  submitted: Set<string>
  brushId: string | null
  onCreate: (input: Omit<ShiftInput, 'location_id'>) => void
  onUpdate: (id: string, patch: Partial<ShiftInput>) => void
  onDelete: (shift: Shift) => void
}

export function DayTimeline(props: Props) {
  const { day, hours, members, positions, shifts, otherShifts, locationNames, avail, submitted, brushId } = props
  const span = hours.close - hours.open
  const scrollRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const [boxW, setBoxW] = useState(1000)
  const [drag, setDrag] = useState<Drag | null>(null)
  const dragRef = useRef<Drag | null>(null)
  const [editing, setEditing] = useState<{ id: string; rect: DOMRect } | null>(null)

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setBoxW(el.clientWidth))
    ro.observe(el); setBoxW(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  // 每分钟占的像素：铺满容器，但不小于 1，保证 15 分钟粒度可操作
  const px = clamp((boxW - NAME_W - 2) / span, 1, 2.4)
  const trackW = span * px

  // 事件处理里读取最新值，避免闭包过期
  const live = useRef({ props, px, span })
  live.current = { props, px, span }

  const posMap = useMemo(() => new Map(positions.map((p) => [p.id, p])), [positions])
  const rowOf = useMemo(() => new Map(members.map((m, i) => [m.id, i])), [members])

  /* ---------- 拖拽 ---------- */
  const locate = (cx: number, cy: number) => {
    const r = trackRef.current!.getBoundingClientRect()
    const { props: p, px: k } = live.current
    const raw = p.hours.open + (cx - r.left) / k
    const row = clamp(Math.floor((cy - r.top) / ROW_H), 0, Math.max(0, p.members.length - 1))
    return { raw, row }
  }
  const startDrag = (d: Drag) => { dragRef.current = d; setDrag(d) }

  const onLaneDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    const { raw, row } = locate(e.clientX, e.clientY)
    const m = members[row]; if (!m) return
    const a = clamp(snap(raw), hours.open, hours.close)
    setEditing(null)
    startDrag({ kind: 'create', memberId: m.id, anchor: a, start: a, end: a })
    e.preventDefault()
  }
  const onShiftDown = (e: React.PointerEvent, s: Shift, kind: 'move' | 'resize-l' | 'resize-r') => {
    if (e.button !== 0) return
    e.stopPropagation(); e.preventDefault()
    const { raw } = locate(e.clientX, e.clientY)
    const block = (e.currentTarget as HTMLElement).closest('[data-shift]') as HTMLElement
    setEditing(null)
    startDrag({ kind, shiftId: s.id, memberId: s.member_id, start: s.start_min, end: s.end_min, grab: raw - s.start_min, orig: { start: s.start_min, end: s.end_min, memberId: s.member_id }, moved: false, x0: e.clientX, y0: e.clientY, rect: block.getBoundingClientRect() })
  }

  const dragging = drag !== null
  useEffect(() => {
    if (!dragging) return
    const move = (e: PointerEvent) => {
      const d = dragRef.current; if (!d) return
      const { props: p } = live.current
      const { raw, row } = locate(e.clientX, e.clientY)
      let next: Drag = d
      if (d.kind === 'create') {
        const cur = clamp(snap(raw), p.hours.open, p.hours.close)
        next = { ...d, start: Math.min(d.anchor, cur), end: Math.max(d.anchor, cur) }
      } else {
        const moved = d.moved || Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 4
        if (d.kind === 'move') {
          const dur = d.orig.end - d.orig.start
          const s = clamp(snap(raw - d.grab), p.hours.open, p.hours.close - dur)
          next = { ...d, moved, start: s, end: s + dur, memberId: p.members[row]?.id ?? d.memberId }
        } else if (d.kind === 'resize-l') {
          next = { ...d, moved, start: clamp(snap(raw), p.hours.open, d.end - MIN_LEN) }
        } else {
          next = { ...d, moved, end: clamp(snap(raw), d.start + MIN_LEN, p.hours.close) }
        }
      }
      dragRef.current = next; setDrag(next)
    }
    const finish = (commit: boolean) => {
      const d = dragRef.current; dragRef.current = null; setDrag(null)
      if (!d || !commit) return
      const { props: p } = live.current
      if (d.kind === 'create') {
        if (d.end - d.start >= 30) p.onCreate({ member_id: d.memberId, position_id: p.brushId, day: p.day, start_min: d.start, end_min: d.end })
        return
      }
      if (!d.moved) { setEditing({ id: d.shiftId, rect: d.rect }); return }
      const patch: Partial<ShiftInput> = {}
      if (d.start !== d.orig.start) patch.start_min = d.start
      if (d.end !== d.orig.end) patch.end_min = d.end
      if (d.memberId !== d.orig.memberId) patch.member_id = d.memberId
      if (Object.keys(patch).length) p.onUpdate(d.shiftId, patch)
    }
    const up = () => finish(true)
    const cancel = () => finish(false)
    const key = (e: KeyboardEvent) => e.key === 'Escape' && finish(false)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('keydown', key)
    document.body.style.cursor = 'grabbing'; document.body.style.userSelect = 'none'
    return () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel); window.removeEventListener('keydown', key)
      document.body.style.cursor = ''; document.body.style.userSelect = ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging])

  /* ---------- 派生数据 ---------- */
  // 拖动中的班次用预览值渲染
  const view = useMemo(() => shifts.map((s) => (drag && drag.kind !== 'create' && drag.shiftId === s.id ? { ...s, member_id: drag.memberId, start_min: drag.start, end_min: drag.end } : s)), [shifts, drag])

  const availByMember = useMemo(() => {
    const m = new Map<string, Availability[]>()
    for (const a of avail) { const l = m.get(a.member_id) ?? []; l.push(a); m.set(a.member_id, l) }
    return m
  }, [avail])

  const issues = useMemo(() => {
    const out = new Map<string, string>()
    for (const s of view) {
      const msgs: string[] = []
      if (view.some((o) => o.id !== s.id && o.member_id === s.member_id && o.start_min < s.end_min && o.end_min > s.start_min)) msgs.push('和同一个人的其他班次时间重叠')
      const clash = otherShifts.find((o) => o.member_id === s.member_id && o.start_min < s.end_min && o.end_min > s.start_min)
      if (clash) msgs.push(`同一时间已在「${locationNames.get(clash.location_id) ?? '其他门店'}」排班`)
      if (submitted.has(s.member_id)) {
        const merged = mergeIntervals((availByMember.get(s.member_id) ?? []).map((a) => [a.start_min, a.end_min]))
        if (!covers(merged, s.start_min, s.end_min)) msgs.push('超出该员工报的可用时间')
      }
      if (msgs.length) out.set(s.id, msgs.join('；'))
    }
    return out
  }, [view, otherShifts, locationNames, availByMember, submitted])

  const coverage = useMemo(() => {
    const slots: { t: number; by: Map<string, number>; total: number }[] = []
    for (let t = hours.open; t < hours.close; t += 30) {
      const by = new Map<string, number>(); let total = 0
      for (const s of view) if (s.start_min < t + 30 && s.end_min > t) { const k = s.position_id ?? '_'; by.set(k, (by.get(k) ?? 0) + 1); total++ }
      slots.push({ t, by, total })
    }
    return slots
  }, [view, hours])
  const maxCover = Math.max(4, ...coverage.map((c) => c.total))

  const dayMin = (memberId: string) => view.filter((s) => s.member_id === memberId).reduce((n, s) => n + s.end_min - s.start_min, 0)
  const hourStep = px >= 1.5 ? 60 : 120
  const ticks: number[] = []
  for (let t = Math.ceil(hours.open / hourStep) * hourStep; t <= hours.close; t += hourStep) ticks.push(t)
  const gridBg = `repeating-linear-gradient(to right, var(--line) 0 1px, transparent 1px ${60 * px}px)`
  const editShift = editing ? shifts.find((s) => s.id === editing.id) : undefined
  const left = (min: number) => (min - hours.open) * px

  return (
    <div className="relative">
      <div ref={scrollRef} className="thin-scroll overflow-x-auto rounded-panel border border-line bg-surface">
        <div className="flex" style={{ width: NAME_W + trackW + 2, minWidth: '100%' }}>
          {/* 左侧姓名列 */}
          <div className="sticky left-0 z-20 shrink-0 border-r border-line bg-surface" style={{ width: NAME_W }}>
            <div className="h-9 border-b border-line" />
            {members.map((m) => (
              <div key={m.id} className="flex flex-col justify-center border-b border-line px-3" style={{ height: ROW_H }}>
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium">{m.name}</span>
                  {m.status === 'trial' && <Badge tone="warn">试工</Badge>}
                </div>
                <span className="num text-[11px] text-mute">
                  {submitted.has(m.id) ? `今日 ${fmtHours(dayMin(m.id))}h` : <span className="text-faint">未报班</span>}
                </span>
              </div>
            ))}
            <div className="flex items-center px-3 text-xs font-medium text-mute" style={{ height: COVER_H }}>人手</div>
          </div>

          {/* 时间轴 */}
          <div className="relative" style={{ width: trackW }}>
            <div className="relative h-9 border-b border-line text-[11px] text-mute num" aria-hidden>
              {ticks.map((t) => (
                <span key={t} className={cn('absolute top-2.5', t === hours.open ? 'translate-x-1' : t === hours.close ? '-translate-x-full -ml-1' : '-translate-x-1/2')} style={{ left: left(t) }}>{fmtMin(t)}</span>
              ))}
            </div>

            <div ref={trackRef} className="relative" style={{ height: members.length * ROW_H, backgroundImage: gridBg }}>
              {/* 行底 + 创建入口 */}
              {members.map((m, i) => (
                <div key={m.id} onPointerDown={onLaneDown} className="absolute inset-x-0 cursor-crosshair border-b border-line" style={{ top: i * ROW_H, height: ROW_H }} data-lane />
              ))}
              {/* 员工可用时间：半透明绿 */}
              {avail.map((a) => {
                const i = rowOf.get(a.member_id); if (i === undefined) return null
                return <div key={a.id} className="pointer-events-none absolute rounded-control bg-avail/25" title={a.note || undefined} style={{ top: i * ROW_H + 4, height: ROW_H - 8, left: left(a.start_min), width: (a.end_min - a.start_min) * px }} />
              })}
              {/* 同一个人在其他门店的班次：灰色斜纹，只读 */}
              {otherShifts.map((o) => {
                const i = rowOf.get(o.member_id); if (i === undefined) return null
                const w = (o.end_min - o.start_min) * px
                return (
                  <div key={o.id} className="pointer-events-none absolute flex flex-col justify-center overflow-hidden rounded-control border border-line px-2 text-mute"
                    title={`在「${locationNames.get(o.location_id) ?? '其他门店'}」 ${fmtMin(o.start_min)} - ${fmtMin(o.end_min)}`}
                    style={{ top: i * ROW_H + 6, height: ROW_H - 12, left: left(o.start_min), width: w, background: 'repeating-linear-gradient(135deg, var(--sunken) 0 6px, var(--line) 6px 12px)' }}>
                    {w >= 56 && (
                      <>
                        <span className="truncate text-[12px] font-semibold leading-tight">{locationNames.get(o.location_id) ?? '其他门店'}</span>
                        <span className="num truncate text-[11px] leading-tight">{fmtMin(o.start_min)}-{fmtMin(o.end_min)}</span>
                      </>
                    )}
                  </div>
                )
              })}
              {/* 已排班次 */}
              {view.map((s) => {
                const i = rowOf.get(s.member_id); if (i === undefined) return null
                const p = s.position_id ? posMap.get(s.position_id) : undefined
                const w = (s.end_min - s.start_min) * px
                const bad = issues.get(s.id)
                const active = drag && drag.kind !== 'create' && drag.shiftId === s.id
                return (
                  <div
                    key={s.id} data-shift
                    onPointerDown={(e) => onShiftDown(e, s, 'move')}
                    onContextMenu={(e) => { e.preventDefault(); props.onDelete(shifts.find((x) => x.id === s.id) ?? s) }}
                    title={bad ? `注意：${bad}` : `${fmtMin(s.start_min)} - ${fmtMin(s.end_min)}${s.note ? `\n${s.note}` : ''}`}
                    className={cn('absolute flex cursor-grab select-none flex-col justify-center overflow-hidden rounded-control px-2 text-white shadow-sm', bad ? 'ring-2 ring-danger ring-offset-1 ring-offset-surface' : '', active && 'z-10 cursor-grabbing opacity-90 shadow-lg')}
                    style={{ top: i * ROW_H + 6, height: ROW_H - 12, left: left(s.start_min), width: w, background: p?.color ?? NO_POS_COLOR, touchAction: 'none', transition: active ? 'none' : undefined }}
                  >
                    <span className="absolute inset-y-0 left-0 w-2 cursor-ew-resize" onPointerDown={(e) => onShiftDown(e, s, 'resize-l')} />
                    <span className="absolute inset-y-0 right-0 w-2 cursor-ew-resize" onPointerDown={(e) => onShiftDown(e, s, 'resize-r')} />
                    {w >= 56 && (
                      <>
                        <span className="flex items-center gap-1 truncate text-[12px] font-semibold leading-tight">
                          {bad && <WarningCircle size={13} weight="fill" className="shrink-0" />}
                          {p?.name ?? '未指定岗位'}
                        </span>
                        <span className="num truncate text-[11px] leading-tight opacity-90">{fmtMin(s.start_min)}-{fmtMin(s.end_min)}</span>
                      </>
                    )}
                  </div>
                )
              })}
              {/* 正在创建的预览 */}
              {drag?.kind === 'create' && drag.end > drag.start && (() => {
                const i = rowOf.get(drag.memberId) ?? 0
                const p = brushId ? posMap.get(brushId) : undefined
                return (
                  <div className="pointer-events-none absolute flex items-center rounded-control px-2 text-xs font-medium text-white opacity-80" style={{ top: i * ROW_H + 6, height: ROW_H - 12, left: left(drag.start), width: (drag.end - drag.start) * px, background: p?.color ?? NO_POS_COLOR }}>
                    <span className="num truncate">{fmtMin(drag.start)}-{fmtMin(drag.end)}</span>
                  </div>
                )
              })()}
            </div>

            {/* 各时段人手：按岗位堆叠 */}
            <div className="relative flex items-end border-t border-line" style={{ height: COVER_H, backgroundImage: gridBg }}>
              {coverage.map((c) => (
                <div key={c.t} className="flex flex-col-reverse justify-start px-px" style={{ width: 30 * px }} title={`${fmtMin(c.t)} 共 ${c.total} 人`}>
                  {[...positions.map((p) => [p.id, p.color] as const), ['_', NO_POS_COLOR] as const].map(([id, color]) => {
                    const n = c.by.get(id) ?? 0
                    return n ? <div key={id} className="w-full first:rounded-b-[2px] last:rounded-t-[2px]" style={{ height: (n / maxCover) * (COVER_H - 22), background: color, opacity: 0.85 }} /> : null
                  })}
                  {c.total > 0 && c.t % 60 === 0 && <span className="num order-last mb-0.5 text-center text-[10px] leading-none text-mute">{c.total}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-mute">
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-6 rounded-sm bg-avail/25" />员工可用时间</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-6 rounded-sm bg-accent ring-2 ring-danger ring-offset-1 ring-offset-bg" />超出可用时间或时间重叠</span>
        {otherShifts.length > 0 && <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-6 rounded-sm border border-line" style={{ background: 'repeating-linear-gradient(135deg, var(--sunken) 0 3px, var(--line) 3px 6px)' }} />在其他门店的班次</span>}
        <span className="hidden lg:inline">在员工那一行拖动来创建班次；拖动班次移动，拖两端调整时长；点击编辑，右键删除。</span>
      </div>

      {editShift && editing && (
        <ShiftEditor
          key={editShift.id} shift={editShift} member={members.find((m) => m.id === editShift.member_id)} positions={positions}
          hours={hours} anchor={editing.rect} issue={issues.get(editShift.id)}
          onClose={() => setEditing(null)}
          onChange={(patch) => props.onUpdate(editShift.id, patch)}
          onDelete={() => { props.onDelete(editShift); setEditing(null) }}
        />
      )}
    </div>
  )
}

/* ---------- 班次编辑浮层 ---------- */
function ShiftEditor({ shift, member, positions, hours, anchor, issue, onClose, onChange, onDelete }: {
  shift: Shift; member?: Member; positions: Position[]; hours: DayHours; anchor: DOMRect; issue?: string
  onClose: () => void; onChange: (p: Partial<ShiftInput>) => void; onDelete: () => void
}) {
  const [note, setNote] = useState(shift.note)
  const W = 300
  const x = clamp(anchor.left, 12, window.innerWidth - W - 12)
  const below = anchor.bottom + 8 + 300 < window.innerHeight
  const setTime = (which: 'start' | 'end', v: string) => {
    if (!v) return
    const t = which === 'start' ? parseHM(v) : parseHM(v, true)
    if (which === 'start') { if (t >= hours.open && t < shift.end_min) onChange({ start_min: t }) }
    else if (t <= hours.close && t > shift.start_min) onChange({ end_min: t })
  }
  return (
    <>
      <div className="fixed inset-0 z-30" onPointerDown={onClose} />
      <div role="dialog" aria-label="编辑班次" className="pop fixed z-40 rounded-panel border border-line bg-surface p-4 shadow-xl" style={{ width: W, left: x, top: below ? anchor.bottom + 8 : undefined, bottom: below ? undefined : window.innerHeight - anchor.top + 8 }}>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold">{member?.name ?? ''}</p>
          <button onClick={onClose} aria-label="关闭" className="press rounded p-1 text-mute hover:bg-sunken"><X size={16} /></button>
        </div>
        {issue && <p className="mb-3 flex items-start gap-1.5 rounded-control bg-danger/10 px-2.5 py-2 text-xs text-danger"><WarningCircle size={14} weight="fill" className="mt-px shrink-0" />{issue}</p>}
        <div className="mb-3 flex flex-wrap gap-1.5">
          {positions.map((p) => (
            <button key={p.id} onClick={() => onChange({ position_id: p.id })}
              className={cn('press flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium', shift.position_id === p.id ? 'border-transparent text-white' : 'border-line text-mute hover:bg-sunken')}
              style={shift.position_id === p.id ? { background: p.color } : undefined}>
              {shift.position_id !== p.id && <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />}{p.name}
            </button>
          ))}
          {positions.length === 0 && <span className="text-xs text-mute">还没有岗位标签，去「设置」里添加</span>}
        </div>
        <div className="mb-3 flex items-center gap-2">
          <input type="time" step={900} value={fmtMin(shift.start_min)} onChange={(e) => setTime('start', e.target.value)} aria-label="开始时间" className="num h-9 flex-1 rounded-control border border-line bg-bg px-2 text-sm" />
          <span className="text-faint">-</span>
          <input type="time" step={900} value={fmtMin(shift.end_min)} onChange={(e) => setTime('end', e.target.value)} aria-label="结束时间" className="num h-9 flex-1 rounded-control border border-line bg-bg px-2 text-sm" />
        </div>
        <Input value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => note !== shift.note && onChange({ note })} placeholder="备注（员工可见）" maxLength={200} className="h-9" aria-label="备注" />
        <div className="mt-3 flex justify-between">
          <Button variant="danger" size="sm" onClick={onDelete}><Trash size={15} />删除</Button>
          <Button size="sm" onClick={() => { if (note !== shift.note) onChange({ note }); onClose() }}>完成</Button>
        </div>
      </div>
    </>
  )
}
