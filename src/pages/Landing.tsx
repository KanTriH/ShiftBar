import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowDown, ArrowRight, ArrowUp } from '@phosphor-icons/react'
import { useToast } from '../components/ui'
import { HeroStage } from '../components/HeroStage'
import { useAuth } from '../auth/AuthContext'
import { api } from '../data'
import { DEMO_SHOP_CODE } from '../data/demoApi'
import { LangSwitch } from '../i18n'
import { translate as t } from '../i18n/core'

/** 首页自己的一套浅色暖调：和应用内页的深浅色主题无关，整页只用这一个主题 */
const PALETTE = {
  '--bg': '#f0f0ee', '--surface': '#fbfaf6', '--sunken': '#e7e5df', '--line': '#d8d5ce',
  '--ink': '#171514', '--mute': '#67625b', '--faint': '#99948b',
  '--accent': '#9c6445', '--accent-ink': '#ffffff', '--accent-soft': '#eadfd6',
  colorScheme: 'light',
} as React.CSSProperties

const SECTIONS = ['hero', 'features', 'for', 'why', 'start'] as const
/** 左侧导航四项 -> 对应的区块 */
const NAV = [
  { target: 'features', active: ['hero', 'features'] },
  { target: 'for', active: ['for'] },
  { target: 'why', active: ['why'] },
  { target: 'start', active: ['start'] },
] as const

const pad = (n: number) => String(n).padStart(2, '0')

export default function Landing() {
  const { user } = useAuth()
  const nav = useNavigate()
  const toast = useToast()
  const [current, setCurrent] = useState(0)
  const refs = useRef<Record<string, HTMLElement | null>>({})

  useEffect(() => {
    try {
      const msg = sessionStorage.getItem('shift-flash')
      if (msg) { sessionStorage.removeItem('shift-flash'); toast(msg) }
    } catch { /* ignore */ }
  }, [toast])
  // 已登录的回访用户不需要再看一遍介绍，直接回到自己的页面
  useEffect(() => { if (user) nav('/go', { replace: true }) }, [user, nav])
  // 整页是浅色：连同页面边缘的底色一起换掉，离开时还原
  useEffect(() => {
    const prev = document.body.style.background
    document.body.style.background = PALETTE['--bg' as keyof typeof PALETTE] as string
    return () => { document.body.style.background = prev }
  }, [])
  // 记录当前看到的是哪个区块（用于左侧导航高亮和页码）
  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) setCurrent(SECTIONS.indexOf(e.target.id as typeof SECTIONS[number]))
    }, { rootMargin: '-45% 0px -45% 0px' })
    SECTIONS.forEach((id) => { const el = refs.current[id]; if (el) io.observe(el) })
    return () => io.disconnect()
  }, [])

  const go = useCallback((id: string) => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    refs.current[id]?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }, [])
  const signup = () => nav('/auth?role=manager&mode=signup')
  const setRef = (id: string) => (el: HTMLElement | null) => { refs.current[id] = el }
  const last = current === SECTIONS.length - 1

  const pill = 'inline-flex h-10 items-center justify-center rounded-full px-3.5 text-sm font-semibold whitespace-nowrap transition active:scale-[0.97] sm:h-11 sm:px-5 sm:text-[15px]'

  return (
    <div className="relative min-h-[100dvh] overflow-x-clip bg-bg text-ink" style={PALETTE}>
      {/* 左侧导航：固定在窗口左侧，随页面滚动高亮 */}
      <nav className="fixed left-8 top-9 z-20 hidden flex-col gap-3 md:flex" aria-label="Sections">
        {NAV.map((n, i) => {
          const on = (n.active as readonly string[]).includes(SECTIONS[current])
          const labels = [t('功能'), t('适合谁'), t('为什么'), t('开始使用')]
          return (
            <div key={n.target} className="flex items-center gap-3">
              <button onClick={() => go(n.target)} className={`text-left text-[17px] transition-colors ${on ? 'font-semibold text-ink underline decoration-1 underline-offset-4' : 'text-mute hover:text-ink'}`}>{labels[i]}</button>
              {on && <button onClick={() => go(n.target)} aria-label={labels[i]} className="grid h-10 w-10 place-items-center rounded-full bg-ink text-surface transition active:scale-95"><ArrowRight size={16} weight="bold" /></button>}
            </div>
          )
        })}
      </nav>

      {/* 页码：当前区块 / 总数，箭头去下一个 */}
      <div className="fixed bottom-7 left-8 z-20 hidden items-end gap-5 md:flex">
        <div className="num text-sm leading-tight"><p className="border-b border-ink pb-0.5">{pad(current + 1)}</p><p className="pt-0.5 text-faint">{pad(SECTIONS.length)}</p></div>
        <button onClick={() => go(last ? 'hero' : SECTIONS[current + 1])} aria-label={last ? t('回到顶部') : t('功能')} className="mb-0.5 grid h-9 w-9 place-items-center rounded-full text-ink transition hover:bg-sunken active:scale-95">
          {last ? <ArrowUp size={20} /> : <ArrowDown size={20} />}
        </button>
      </div>

      {/* ───── 01 首屏 ───── */}
      <section id="hero" ref={setRef('hero')} className="relative flex min-h-[100dvh] flex-col px-4 sm:px-8">
        <header className="relative flex h-20 items-center justify-end gap-1.5 sm:gap-2">
          <span className="pointer-events-none absolute left-1/2 hidden -translate-x-1/2 text-[15px] font-bold tracking-[0.12em] sm:block">— SHIFTBAR —</span>
          <span className="mr-auto text-[15px] font-bold tracking-[0.12em] sm:hidden">SHIFTBAR</span>
          <LangSwitch className="!h-10 shrink-0" />
          <Link to="/auth" className={`${pill} border border-ink`}>{t('登录')}</Link>
          <Link to="/auth?role=manager&mode=signup" className={`${pill} bg-ink text-surface hover:bg-ink/90`}>{t('开始使用')}</Link>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center pb-16 pt-2 [--wm:clamp(4rem,16vw,16rem)]">
          <h1 aria-label="ShiftBar" className="relative z-0 select-none whitespace-nowrap text-center leading-[0.8]" style={{ fontSize: 'var(--wm)', letterSpacing: '-0.075em', fontFamily: '"Bricolage Grotesque Variable", "Geist Variable", system-ui, sans-serif', fontWeight: 800 }}>
            Shift<span style={{ color: 'var(--accent)' }}>B</span>ar
          </h1>
          <HeroStage className="relative z-10 w-[min(92vw,calc(var(--wm)*2.7))] min-w-[min(92vw,22rem)] [margin-top:calc(var(--wm)*-0.2)]" />
          <p className="mt-9 text-center text-lg text-mute sm:text-xl">{t('在线报班 · 拖拽排班 · 导入日历')}</p>
          <div className="mt-5 flex items-center gap-2.5">
            <button onClick={signup} className={`${pill} h-14 bg-ink px-8 text-lg text-surface hover:bg-ink/90`}>{t('开始使用')}</button>
            <button onClick={signup} aria-label={t('开始使用')} className="grid h-14 w-14 place-items-center rounded-full bg-ink text-surface transition hover:bg-ink/90 active:scale-95"><ArrowRight size={20} weight="bold" /></button>
          </div>
          <p className="mt-5 text-sm text-mute">{t('已有账号？')}<Link to="/auth" className="font-semibold text-ink underline underline-offset-2">{t('登录')}</Link></p>
        </div>
      </section>

      {/* ───── 02 功能 ───── */}
      <section id="features" ref={setRef('features')} className="flex min-h-[85dvh] items-center border-t border-line px-4 py-20 sm:px-8 md:pl-56">
        <div className="mx-auto w-full max-w-5xl">
          <h2 className="max-w-[18ch] text-balance text-[clamp(1.75rem,3.4vw,2.75rem)] font-bold leading-tight tracking-tight">{t('从报班到排班，再到日历，一条线走完。')}</h2>
          <ol className="mt-12 divide-y divide-line border-y border-line">
            {[
              [t('员工报班'), t('打开链接，填上能上班的时间，不用注册。')],
              [t('店长排班'), t('所有人的可用时间摆在一条时间轴上，拖一拖就排好。')],
              [t('导入日历'), t('发布后员工一键导入手机日历，不用再翻聊天记录找班表。')],
            ].map(([title, body]) => (
              <li key={title} className="grid gap-2 py-7 sm:grid-cols-[1fr_1.1fr] sm:items-baseline sm:gap-10">
                <h3 className="text-[clamp(1.6rem,3.6vw,2.75rem)] font-extrabold leading-none tracking-tight">{title}</h3>
                <p className="max-w-[34rem] text-base leading-relaxed text-mute sm:text-lg">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ───── 03 适合谁 ───── */}
      <section id="for" ref={setRef('for')} className="flex min-h-[70dvh] items-center border-t border-line px-4 py-20 sm:px-8 md:pl-56">
        <div className="mx-auto w-full max-w-5xl">
          <h2 className="text-[clamp(1.75rem,3.4vw,2.75rem)] font-bold leading-tight tracking-tight">{t('给小店用的排班工具')}</h2>
          <p className="mt-5 max-w-[36rem] text-base leading-relaxed text-mute sm:text-lg">{t('人不多，班次常变，也没有专人排班。需要的是一个打开就能用的工具。')}</p>
          <ul className="mt-10 flex flex-wrap gap-3">
            {[t('咖啡店'), t('餐厅'), t('酒吧'), t('零售店')].map((s) => (
              <li key={s} className="rounded-full border border-ink px-6 py-2.5 text-lg font-semibold">{s}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* ───── 04 为什么 ───── */}
      <section id="why" ref={setRef('why')} className="flex min-h-[70dvh] items-center border-t border-line px-4 py-20 sm:px-8 md:pl-56">
        <div className="mx-auto w-full max-w-5xl">
          <h2 className="text-[clamp(1.75rem,3.4vw,2.75rem)] font-bold leading-tight tracking-tight">{t('为什么选 ShiftBar')}</h2>
          <ul className="mt-10 grid gap-x-12 gap-y-7 sm:grid-cols-2">
            {[
              t('员工不用注册就能报班，打开链接填上名字即可。'),
              t('所有人的可用时间在同一条时间轴上，排班时一眼看清。'),
              t('多门店、岗位标签、试用与正式员工，都可以分开管理。'),
              t('加拿大法定假日会提前提醒，班表可以导出 PDF。'),
            ].map((s) => (
              <li key={s} className="border-t border-ink pt-4 text-base leading-relaxed sm:text-lg">{s}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* ───── 05 开始使用 ───── */}
      <section id="start" ref={setRef('start')} className="flex min-h-[70dvh] items-center border-t border-line px-4 py-20 sm:px-8 md:pl-56">
        <div className="mx-auto w-full max-w-5xl">
          <h2 className="text-[clamp(2.25rem,6vw,5rem)] font-black leading-[1.02] tracking-tight">{t('开始排下周的班')}</h2>
          <p className="mt-5 max-w-[34rem] text-base leading-relaxed text-mute sm:text-lg">{t('注册店长账号，创建店铺，再把链接发给员工。')}</p>
          <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
            <div className="flex items-center gap-2.5">
              <button onClick={signup} className={`${pill} h-14 bg-ink px-8 text-lg text-surface hover:bg-ink/90`}>{t('开始使用')}</button>
              <button onClick={signup} aria-label={t('开始使用')} className="grid h-14 w-14 place-items-center rounded-full bg-ink text-surface transition hover:bg-ink/90 active:scale-95"><ArrowRight size={20} weight="bold" /></button>
            </div>
            <p className="text-sm text-mute">{t('已有账号？')}<Link to="/auth" className="font-semibold text-ink underline underline-offset-2">{t('登录')}</Link></p>
          </div>
          {api.mode === 'demo' && (
            <p className="mt-12 w-fit max-w-full rounded-full bg-accent-soft px-4 py-1.5 text-xs text-accent">
              {t('演示模式：还没连接 Supabase，数据只保存在这个浏览器。演示店铺码：')}
              <Link to={`/s/${DEMO_SHOP_CODE}`} className="num font-semibold underline">{DEMO_SHOP_CODE}</Link>
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
