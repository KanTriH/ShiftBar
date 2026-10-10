import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight } from '@phosphor-icons/react'
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

export default function Landing() {
  const { user } = useAuth()
  const nav = useNavigate()
  const toast = useToast()

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
  // 登录和注册是同一个入口：店长和员工都从这里进，注册时在页面上自己选身份
  const signup = () => nav('/auth?mode=signup')

  const pill = 'inline-flex h-10 items-center justify-center rounded-full px-3.5 text-sm font-semibold whitespace-nowrap transition active:scale-[0.97] sm:h-11 sm:px-5 sm:text-[15px]'

  return (
    <div className="relative min-h-[100dvh] overflow-clip bg-bg text-ink" style={PALETTE}>
      <section className="relative flex min-h-[100dvh] flex-col px-4 sm:px-8">
        <header className="relative flex h-20 items-center justify-end gap-1.5 sm:gap-2">
          <span className="pointer-events-none absolute left-1/2 hidden -translate-x-1/2 text-[15px] font-bold tracking-[0.12em] sm:block">— SHIFTBAR —</span>
          <span className="mr-auto text-[15px] font-bold tracking-[0.12em] sm:hidden">SHIFTBAR</span>
          <LangSwitch className="!h-10 shrink-0" />
          <Link to="/auth" className={`${pill} border border-ink`}>{t('登录')}</Link>
          <Link to="/auth?mode=signup" className={`${pill} bg-ink text-surface hover:bg-ink/90`}>{t('开始使用')}</Link>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center pb-6 pt-0 [--wm:clamp(4rem,16vw,16rem)]">
          <h1 aria-label="ShiftBar" className="relative z-0 select-none whitespace-nowrap text-center leading-[0.8]" style={{ fontSize: 'var(--wm)', letterSpacing: '-0.075em', fontFamily: '"Bricolage Grotesque Variable", "Geist Variable", system-ui, sans-serif', fontWeight: 800 }}>
            Shift<span style={{ color: 'var(--accent)' }}>B</span>ar
          </h1>
          <HeroStage className="relative z-10 w-[min(92vw,calc(var(--wm)*2.7))] min-w-[min(92vw,22rem)] [margin-top:calc(var(--wm)*-0.2)]" />
          <p className="mt-7 text-center text-lg text-mute sm:text-xl">{t('在线报班 · 拖拽排班 · 导入日历')}</p>
          <div className="mt-5 flex items-center gap-2.5">
            <button onClick={signup} className={`${pill} h-14 bg-ink px-8 text-lg text-surface hover:bg-ink/90`}>{t('开始使用')}</button>
            <button onClick={signup} aria-label={t('开始使用')} className="grid h-14 w-14 place-items-center rounded-full bg-ink text-surface transition hover:bg-ink/90 active:scale-95"><ArrowRight size={20} weight="bold" /></button>
          </div>
          <p className="mt-5 text-sm text-mute">{t('已有账号？')}<Link to="/auth" className="font-semibold text-ink underline underline-offset-2">{t('登录')}</Link></p>
        </div>
        {api.mode === 'demo' && (
          <p className="mx-auto mb-4 w-fit max-w-full rounded-full bg-accent-soft px-4 py-1.5 text-center text-xs text-accent">
            {t('演示模式：还没连接 Supabase，数据只保存在这个浏览器。演示店铺码：')}
            <Link to={`/s/${DEMO_SHOP_CODE}`} className="num font-semibold underline">{DEMO_SHOP_CODE}</Link>
          </p>
        )}
      </section>

    </div>
  )
}
