import { useEffect, useRef } from 'react'
import { translate as t } from '../i18n/core'

interface Row { id: number; name: string; avail: [number, number]; shift: [number, number]; pos: keyof typeof POS; drag?: boolean }

/** 一格 = 一小时，营业时间 09:00 - 21:00 共 12 格；班次和可用时间都落在整点上 */
const H = 12
/** 同一岗位同一颜色。饱和度压低，让按钮仍是页面上最醒目的元素 */
const POS = {
  cashier: '#b86a52',
  bar: '#5a78b4',
  prep: '#8a72ad',
} as const
const TICKS = [{ at: 0, label: '09:00' }, { at: 4, label: '13:00' }, { at: 8, label: '17:00' }, { at: 12, label: '21:00' }]

const ROWS: Row[] = [
  { id: 1, name: '小林', avail: [0, 8], shift: [0, 6], pos: 'cashier' },
  { id: 2, name: 'Mei', avail: [3, 12], shift: [6, 12], pos: 'bar', drag: true },
  { id: 3, name: '老周', avail: [2, 10], shift: [2, 7], pos: 'prep' },
  { id: 4, name: 'Ravi', avail: [0, 5], shift: [0, 4], pos: 'prep' },
]

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/**
 * 首页右侧的排班预览。
 * - 卡片跟随鼠标做 3D 倾斜；按住拖动可以转动它，松手后弹回
 * - 报班色带依次展开，班次依次落位，其中一个班次会循环被"拖"到另一个时段
 * - 减少动态效果（prefers-reduced-motion）时保持静止
 * 旋转由 requestAnimationFrame 直接写入 DOM，不经过 React 状态。
 */
export function HeroStage() {
  const stageRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const stage = stageRef.current
    const card = cardRef.current
    if (!stage || !card) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let px = 0.5, py = 0.5
    let pointerAt = 0
    let dragging = false
    let startX = 0, startY = 0
    let dragRx = 0, dragRy = 0
    let baseRx = 0, baseRy = 0
    let rx = 0, ry = 0, vx = 0, vy = 0
    let raf = 0

    const onMove = (e: PointerEvent) => {
      px = e.clientX / window.innerWidth
      py = e.clientY / window.innerHeight
      pointerAt = performance.now()
      if (dragging) {
        dragRy = clamp(baseRy + (e.clientX - startX) * 0.4, -70, 70)
        dragRx = clamp(baseRx - (e.clientY - startY) * 0.3, -40, 40)
      }
    }
    const onDown = (e: PointerEvent) => {
      dragging = true
      startX = e.clientX; startY = e.clientY
      baseRx = dragRx; baseRy = dragRy
      stage.setPointerCapture(e.pointerId)
      stage.dataset.drag = '1'
    }
    const onUp = () => {
      if (!dragging) return
      dragging = false
      dragRx = 0; dragRy = 0
      delete stage.dataset.drag
    }

    const tick = (now: number) => {
      const following = now - pointerAt < 4000
      // 鼠标一段时间不动（或触屏）时缓慢自摆，保持画面有生命力
      const tx = (following ? (0.5 - py) * 16 : Math.sin(now / 2300) * 4) + dragRx
      const ty = (following ? (px - 0.5) * 26 : Math.sin(now / 1800) * 9) + dragRy
      // 弹簧：松手后带一点回弹
      vx = (vx + (tx - rx) * 0.07) * 0.8
      vy = (vy + (ty - ry) * 0.07) * 0.8
      rx += vx; ry += vy
      card.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`
      stage.style.setProperty('--hx', `${(50 + ry * 1.6).toFixed(1)}%`)
      stage.style.setProperty('--hy', `${(10 - rx * 2).toFixed(1)}%`)
      raf = requestAnimationFrame(tick)
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    stage.addEventListener('pointerdown', onDown)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      stage.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [])

  return (
    <div
      ref={stageRef}
      className="relative w-full max-w-[34rem] cursor-grab touch-pan-y select-none data-[drag]:cursor-grabbing lg:justify-self-end"
      style={{ perspective: '1200px' }}
      aria-hidden
    >
      {/* 卡片背后的光晕，随卡片一起倾斜时形成纵深 */}
      <div className="pointer-events-none absolute -inset-10 -z-10 rounded-full opacity-70 blur-3xl" style={{ background: 'radial-gradient(closest-side, color-mix(in srgb, var(--accent) 38%, transparent), transparent)' }} />

      <div ref={cardRef} className="relative [transform-style:preserve-3d]" style={{ willChange: 'transform' }}>
        <div className="relative rounded-panel border border-line bg-surface p-5 shadow-[0_30px_80px_-30px_color-mix(in_srgb,var(--accent)_55%,transparent)] [transform-style:preserve-3d]">
          <div className="relative mb-3 ml-14 h-4 text-[11px] text-faint num">
            {TICKS.map((k, i) => (
              <span key={k.label} className="absolute top-0" style={{ left: `${(k.at / H) * 100}%`, transform: `translateX(${i === 0 ? '0' : i === TICKS.length - 1 ? '-100%' : '-50%'})` }}>{k.label}</span>
            ))}
          </div>
          <div className="relative [transform-style:preserve-3d]">
            {/* 小时参考线：让每个班次的起止时间可以直接读出来 */}
            <div className="pointer-events-none absolute inset-y-0 left-14 right-0" aria-hidden>
              {Array.from({ length: H + 1 }, (_, i) => (
                <span key={i} className={`absolute inset-y-0 w-px ${i % 4 === 0 ? 'bg-line' : 'bg-line/50'}`} style={{ left: `${(i / H) * 100}%` }} />
              ))}
            </div>
            <div className="relative flex flex-col gap-2.5 [transform-style:preserve-3d]">
              {ROWS.map((r, i) => (
                <div key={r.id} className="flex items-center gap-3 [transform-style:preserve-3d]">
                  <span className="w-11 shrink-0 truncate text-xs font-medium text-mute">{r.name}</span>
                  <div className="relative h-10 flex-1 rounded-control bg-sunken/70 [transform-style:preserve-3d]">
                    <div className="hs-grow absolute inset-y-0 rounded-control border border-avail/50 bg-avail/20" style={{ left: `${(r.avail[0] / H) * 100}%`, width: `${((r.avail[1] - r.avail[0]) / H) * 100}%`, ['--d' as string]: `${0.15 + i * 0.12}s` }} />
                    <div className="hs-place absolute inset-y-1 [translate:0_0_16px]" style={{ left: `${(r.shift[0] / H) * 100}%`, width: `${((r.shift[1] - r.shift[0]) / H) * 100}%`, ['--d' as string]: `${0.7 + i * 0.14}s` }}>
                      <div className={`flex h-full items-center rounded-[6px] px-2.5 text-[11px] font-medium text-white ${r.drag ? 'hs-drag' : ''}`} style={{ background: POS[r.pos] }}>{r.pos}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 pl-14 text-xs text-mute">
            <span className="flex items-center gap-2"><span className="inline-block h-3 w-5 rounded-sm border border-avail/50 bg-avail/20" />{t('员工报的可用时间')}</span>
            {(Object.keys(POS) as (keyof typeof POS)[]).map((k) => (
              <span key={k} className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: POS[k] }} />{k}</span>
            ))}
          </div>
          {/* 随倾斜移动的高光 */}
          <div className="pointer-events-none absolute inset-0 rounded-panel" style={{ background: 'radial-gradient(circle at var(--hx, 30%) var(--hy, 0%), color-mix(in srgb, white 16%, transparent), transparent 55%)' }} />
        </div>
      </div>
    </div>
  )
}
