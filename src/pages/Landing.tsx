import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, CalendarPlus, Rows, Users } from '@phosphor-icons/react'
import { Logo, useToast } from '../components/ui'
import { HeroStage } from '../components/HeroStage'
import { useAuth } from '../auth/AuthContext'
import { api } from '../data'
import { DEMO_SHOP_CODE } from '../data/demoApi'
import { LangSwitch } from '../i18n'
import { translate as t } from '../i18n/core'

/** 品牌色按钮：深色下是 logo 的奶油色，浅色下是 logo 的深海军蓝 */
const BRAND_BTN = 'inline-flex items-center justify-center gap-2 rounded-control font-medium transition hover:brightness-110 active:scale-[0.98]'
const brandStyle = { background: 'var(--logo-bar)', color: 'var(--surface)' } as const

/** t() 必须在渲染时调用（切换语言会重新渲染），所以做成函数 */
const steps = () => [
  { icon: Users, title: t('员工报班'), body: t('打开链接，填上能上班的时间，不用注册。') },
  { icon: Rows, title: t('店长排班'), body: t('所有人的可用时间摆在一条时间轴上，拖一拖就排好。') },
  { icon: CalendarPlus, title: t('导入日历'), body: t('发布后员工一键导入手机日历，不用再翻聊天记录找班表。') },
]

export default function Landing() {
  const { user } = useAuth()
  const nav = useNavigate()
  const toast = useToast()
  // 从别的页面带过来的一次性提示（例如注销账号成功）
  useEffect(() => {
    try {
      const msg = sessionStorage.getItem('shift-flash')
      if (msg) { sessionStorage.removeItem('shift-flash'); toast(msg) }
    } catch { /* ignore */ }
  }, [toast])
  // 已登录的回访用户不需要再看一遍介绍，直接回到自己的页面
  useEffect(() => { if (user) nav('/go', { replace: true }) }, [user, nav])

  return (
    <div className="relative min-h-[100dvh] overflow-x-clip">
      {/* 背景光：从右上角斜向打下来 */}
      <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(60% 55% at 78% 30%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 70%), linear-gradient(115deg, transparent 40%, color-mix(in srgb, var(--accent) 7%, transparent) 55%, transparent 70%)' }} />
      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col px-4 sm:px-6">
        <header className="flex h-16 items-center justify-between gap-1">
          <Link to="/" aria-label="ShiftBar"><Logo className="text-xl sm:text-2xl" /></Link>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <LangSwitch />
            <Link to="/auth" className="rounded-control px-2 py-1.5 text-sm font-medium whitespace-nowrap text-mute hover:bg-sunken hover:text-ink">{t('登录')}</Link>
            <Link to="/auth?role=manager&mode=signup" className={`${BRAND_BTN} h-9 px-3 text-sm whitespace-nowrap sm:px-3.5`} style={brandStyle}>{t('开始使用')}</Link>
          </div>
        </header>

        <main className="grid items-center gap-12 pb-16 pt-6 lg:min-h-[calc(100dvh-8rem)] lg:grid-cols-[1fr_1.05fr] lg:gap-16 lg:pt-0">
          <div>
            <h1 className="max-w-[16ch] break-keep text-[clamp(2.4rem,5.4vw,4.25rem)] font-semibold leading-[1.12] tracking-tight text-balance" style={{ fontFamily: '"Fredoka", "Geist Variable", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif' }}>
              {t('拖一拖，下周的班就排好了')}
            </h1>
            <p className="mt-6 max-w-[32rem] break-keep text-lg leading-relaxed text-balance text-ink/80 sm:text-xl">{t('员工自己填好能上班的时间，你在时间轴上一眼看清，拖一拖排好，发布后一键进手机日历。')}</p>
            <button className={`${BRAND_BTN} mt-9 h-12 w-full px-7 text-base sm:w-auto`} style={brandStyle} onClick={() => nav('/auth?role=manager&mode=signup')}>
              {t('进入页面')}<ArrowRight size={18} />
            </button>
          </div>
          <HeroStage />
        </main>

        <section className="border-t border-line pb-16 pt-10" aria-label="How it works">
          <ol className="grid gap-8 sm:grid-cols-3 sm:gap-10">
            {steps().map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-control bg-sunken" style={{ color: 'var(--logo-bar)' }}><Icon size={20} weight="duotone" /></span>
                <div>
                  <h2 className="text-base font-semibold">{title}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-mute">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {api.mode === 'demo' && (
          <footer className="pb-6">
            <p className="mx-auto w-fit max-w-full rounded-full bg-accent-soft px-4 py-1.5 text-center text-xs text-accent">
              {t('演示模式：还没连接 Supabase，数据只保存在这个浏览器。演示店铺码：')}
              <Link to={`/s/${DEMO_SHOP_CODE}`} className="num font-semibold underline">{DEMO_SHOP_CODE}</Link>
            </p>
          </footer>
        )}
      </div>
    </div>
  )
}
