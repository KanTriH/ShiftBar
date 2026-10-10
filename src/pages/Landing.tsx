import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight } from '@phosphor-icons/react'
import { Button, Logo, useToast } from '../components/ui'
import { HeroStage } from '../components/HeroStage'
import { useAuth } from '../auth/AuthContext'
import { api } from '../data'
import { DEMO_SHOP_CODE } from '../data/demoApi'
import { LangSwitch } from '../i18n'
import { translate as t } from '../i18n/core'

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

  return (
    <div className="relative min-h-[100dvh] overflow-x-clip">
      {/* 背景光：从右上角斜向打下来，两种主题下都由强调色调出 */}
      <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(60% 55% at 78% 38%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 70%), linear-gradient(115deg, transparent 40%, color-mix(in srgb, var(--accent) 7%, transparent) 55%, transparent 70%)' }} />
    <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col px-4 sm:px-6">
      {/* 首屏正文里已经有放大的品牌标识，页头不再重复放一个小的 */}
      <header className="flex h-16 items-center justify-end gap-2">
        <LangSwitch />
        {user
          ? <Link to="/go" className="rounded-control px-2.5 py-1.5 text-sm font-medium text-accent hover:bg-accent-soft">{t('进入我的页面')}</Link>
          : <Link to="/auth" className="rounded-control px-2.5 py-1.5 text-sm font-medium text-mute hover:bg-sunken hover:text-ink">{t('登录')}</Link>}
      </header>

      <main className="grid flex-1 items-center gap-12 pb-16 pt-4 lg:grid-cols-[1fr_1.05fr] lg:gap-20">
        <div>
          <h1><Logo className="text-[clamp(2.75rem,7.5vw,5rem)]" /></h1>
          <p className="mt-6 max-w-[34rem] break-keep text-lg leading-relaxed text-balance text-mute">{t('员工在线报班，店长在时间轴上拖拽排班，发布后员工一键导入日历。')}</p>
          <Button variant="primary" className="mt-9 h-12 w-full px-7 text-base sm:w-auto" onClick={() => nav(user ? '/go' : '/auth?role=manager&mode=signup')}>
            {t('进入页面')}<ArrowRight size={18} />
          </Button>
        </div>
        <HeroStage />
      </main>

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
