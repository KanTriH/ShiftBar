import { useEffect, useRef } from 'react'
import { translate as t } from '../i18n/core'

interface Row { id: number; name: string; avail: [number, number]; shift: { a: number; b: number; c: string; t: string }; drag?: boolean }

const ROWS: Row[] = [
  { id: 1, name: '小林', avail: [0, 0.62], shift: { a: 0, b: 0.5, c: '#c9532f', t: 'cashier' } },
  { id: 2, name: 'Mei', avail: [0.2, 1], shift: { a: 0.5, b: 1, c: '#3a64c8', t: 'bar' }, drag: true },
  { id: 3, name: '老周', avail: [0.15, 0.8], shift: { a: 0.15, b: 0.55, c: '#1f7a6d', t: 'prep' } },
  { id: 4, name: 'Ravi', avail: [0, 0.4], shift: { a: 0, b: 0.38, c: '#8b4fb3', t: 'prep' } },
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
          <div className="mb-3 ml-14 flex justify-between text-[11px] text-faint num"><span>09:00</span><span>13:00</span><span>17:00</span><span>21:00</span></div>
          <div className="flex flex-col gap-2.5 [transform-style:preserve-3d]">
            {ROWS.map((r, i) => (
              <div key={r.id} className="flex items-center gap-3 [transform-style:preserve-3d]">
                <span className="w-11 shrink-0 truncate text-xs font-medium text-mute">{r.name}</span>
                <div className="relative h-10 flex-1 rounded-control bg-sunken [transform-style:preserve-3d]">
                  <div className="hs-grow absolute inset-y-0 rounded-control bg-avail/25" style={{ left: `${r.avail[0] * 100}%`, width: `${(r.avail[1] - r.avail[0]) * 100}%`, ['--d' as string]: `${0.15 + i * 0.12}s` }} />
                  <div className="hs-place absolute inset-y-1 [translate:0_0_16px]" style={{ left: `${r.shift.a * 100}%`, width: `${(r.shift.b - r.shift.a) * 100}%`, ['--d' as string]: `${0.7 + i * 0.14}s` }}>
                    <div className={`flex h-full items-center rounded-[6px] px-2.5 text-[11px] font-medium text-white ${r.drag ? 'hs-drag' : ''}`} style={{ background: r.shift.c }}>{r.shift.t}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 flex items-center gap-2 pl-14 text-xs text-mute">
            <span className="inline-block h-3 w-5 rounded-sm bg-avail/25" />{t('员工报的可用时间')}
            <span className="ml-3 inline-block h-3 w-5 rounded-sm bg-accent" />{t('店长排的班次')}
          </p>
          {/* 随倾斜移动的高光 */}
          <div className="pointer-events-none absolute inset-0 rounded-panel" style={{ background: 'radial-gradient(circle at var(--hx, 30%) var(--hy, 0%), color-mix(in srgb, white 16%, transparent), transparent 55%)' }} />
        </div>
      </div>
    </div>
  )
}
