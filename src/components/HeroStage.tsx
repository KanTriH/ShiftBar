import { useEffect, useRef } from 'react'
import { Cursor } from '@phosphor-icons/react'
import { translate as t } from '../i18n/core'

type Pos = 'front' | 'bar' | 'prep'
interface Row { id: number; name: string; avail: [number, number]; shift: [number, number]; pos: Pos; drag?: boolean }

/** 营业时间 09:00 - 21:00，共 12 格，一格一小时；班次和可用时间都落在整点上 */
const OPEN = 9
const H = 12
const TICKS = [9, 12, 15, 18, 21]
/** 同一岗位同一颜色，低饱和的暖色，和页面的奶油底、陶土色配套 */
const POS_COLOR: Record<Pos, string> = { front: '#e3d6c8', bar: '#d4b9a8', prep: '#bcc2a2' }

const ROWS: Row[] = [
  { id: 1, name: '小林', avail: [9, 17], shift: [9, 15], pos: 'front' },
  { id: 2, name: 'Mei', avail: [12, 21], shift: [15, 21], pos: 'bar', drag: true },
  { id: 3, name: '老周', avail: [11, 19], shift: [11, 16], pos: 'prep' },
  { id: 4, name: 'Ravi', avail: [9, 14], shift: [9, 13], pos: 'front' },
]

const pct = (h: number) => `${((h - OPEN) / H) * 100}%`
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/**
 * 首页中央的排班卡片。
 * - 入场：可用时段依次展开，班次依次落位
 * - 循环：Mei 的"吧台"班次被拎起、拖到更早的时段（留下虚线占位和光标），再拖回来
 * - 交互：卡片跟随鼠标倾斜；按住拖动可以转动，松手后带回弹地归位
 * - 减少动态效果时保持静止
 * 旋转由 requestAnimationFrame 直接写入 DOM，不经过 React 状态。
 */
export function HeroStage({ className = '' }: { className?: string }) {
  const stageRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const label: Record<Pos, string> = { front: t('前台'), bar: t('吧台'), prep: t('备料') }

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
      const tx = (following ? (0.5 - py) * 12 : Math.sin(now / 2300) * 3) + dragRx
      const ty = (following ? (px - 0.5) * 18 : Math.sin(now / 1800) * 5) + dragRy
      vx = (vx + (tx - rx) * 0.07) * 0.8
      vy = (vy + (ty - ry) * 0.07) * 0.8
      rx += vx; ry += vy
      card.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) rotateZ(-3deg)`
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
      className={`relative cursor-grab touch-pan-y select-none data-[drag]:cursor-grabbing ${className}`}
      style={{ perspective: '1400px' }}
      aria-hidden
    >
      <div ref={cardRef} className="relative [transform-style:preserve-3d]" style={{ transform: 'rotateZ(-3deg)', willChange: 'transform' }}>
        <div className="relative rounded-[28px] bg-surface p-5 shadow-[0_40px_70px_-30px_rgb(70_45_25/0.35),0_2px_0_0_rgb(255_255_255/0.6)_inset] [transform-style:preserve-3d] sm:p-7">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-ink">{t('本周排班')}<span className="ml-2 text-xs font-normal text-faint">{t('前台 + 吧台 + 备料')}</span></p>
            <div className="flex shrink-0 gap-1.5 text-xs font-medium">
              <span className="rounded-full border border-line px-3 py-1 text-mute">{t('日')}</span>
              <span className="rounded-full bg-ink px-3 py-1 text-surface">{t('周')}</span>
            </div>
          </div>

          <div className="relative ml-14 mb-2 h-4 text-[11px] text-faint num">
            {TICKS.map((h, i) => (
              <span key={h} className="absolute top-0" style={{ left: pct(h), transform: `translateX(${i === 0 ? '0' : i === TICKS.length - 1 ? '-100%' : '-50%'})` }}>{h}</span>
            ))}
          </div>

          <div className="relative [transform-style:preserve-3d]">
            {/* 小时参考线 */}
            <div className="pointer-events-none absolute inset-y-0 left-14 right-0" aria-hidden>
              {Array.from({ length: H + 1 }, (_, i) => (
                <span key={i} className={`absolute inset-y-0 w-px ${i % 3 === 0 ? 'bg-line' : 'bg-line/50'}`} style={{ left: `${(i / H) * 100}%` }} />
              ))}
            </div>
            <div className="relative flex flex-col gap-3 [transform-style:preserve-3d]">
              {ROWS.map((r, i) => (
                <div key={r.id} className="flex items-center gap-3 [transform-style:preserve-3d]">
                  <span className="w-11 shrink-0 truncate text-xs font-medium text-mute">{r.name}</span>
                  <div className="relative h-10 flex-1 [transform-style:preserve-3d]">
                    <div className="hs-grow absolute inset-y-0 rounded-full border border-dashed border-ink/20" style={{ left: pct(r.avail[0]), width: `${((r.avail[1] - r.avail[0]) / H) * 100}%`, ['--d' as string]: `${0.15 + i * 0.12}s` }} />
                    {r.drag && (
                      <>
                        {/* 拖动目标和起点的虚线占位 */}
                        <div className="hs-ghost-a absolute inset-y-1 rounded-full border border-dashed border-ink/50" style={{ left: pct(12), width: `${(6 / H) * 100}%` }} />
                        <div className="hs-ghost-b absolute inset-y-1 rounded-full border border-dashed border-ink/50" style={{ left: pct(r.shift[0]), width: `${((r.shift[1] - r.shift[0]) / H) * 100}%` }} />
                      </>
                    )}
                    <div className="hs-place absolute inset-y-1 [translate:0_0_16px]" style={{ left: pct(r.shift[0]), width: `${((r.shift[1] - r.shift[0]) / H) * 100}%`, ['--d' as string]: `${0.7 + i * 0.14}s` }}>
                      <div className={`relative flex h-full items-center rounded-full px-3.5 text-xs font-medium text-ink ${r.drag ? 'hs-drag' : ''}`} style={{ background: POS_COLOR[r.pos], ['--blk' as string]: POS_COLOR[r.pos] }}>
                        {label[r.pos]}
                        {r.drag && <Cursor size={22} weight="fill" className="hs-cursor absolute -bottom-3 right-3 text-ink [filter:drop-shadow(0_0_1px_#fff)]" />}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* 随倾斜移动的高光 */}
          <div className="pointer-events-none absolute inset-0 rounded-[28px]" style={{ background: 'radial-gradient(circle at var(--hx, 30%) var(--hy, 0%), rgb(255 255 255 / 0.5), transparent 55%)' }} />
        </div>
      </div>
    </div>
  )
}
