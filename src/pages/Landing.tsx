import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight } from '@phosphor-icons/react'
import { Button, Input, Logo, useToast } from '../components/ui'
import { useAuth } from '../auth/AuthContext'
import { api } from '../data'
import { DEMO_SHOP_CODE } from '../data/demoApi'
import { LangSwitch } from '../i18n'
import { translate as t } from '../i18n/core'

const ROWS = [
  { id: 1, avail: [0, 0.62], shifts: [{ a: 0, b: 0.5, c: '#c9532f', t: 'cashier' }] },
  { id: 2, avail: [0.3, 1], shifts: [{ a: 0.42, b: 1, c: '#3a64c8', t: 'bar' }] },
  { id: 3, avail: [0.15, 0.8], shifts: [{ a: 0.15, b: 0.55, c: '#1f7a6d', t: 'prep' }] },
  { id: 4, avail: [0, 0.4], shifts: [{ a: 0, b: 0.38, c: '#1f7a6d', t: 'prep' }] },
]

/** 用与排班页相同的视觉语言拼出的迷你预览（半透明绿 = 员工可用，实色 = 已排班） */
function TimelinePreview() {
  return (
    <div
      className="w-full max-w-[34rem] rounded-panel border border-line bg-surface p-5 shadow-[0_18px_50px_-24px_color-mix(in_srgb,var(--accent)_45%,transparent)] lg:justify-self-end"
      aria-hidden
    >
      <div className="mb-3 flex justify-between text-[11px] text-faint num"><span>09:00</span><span>13:00</span><span>17:00</span><span>21:00</span></div>
      <div className="flex flex-col gap-2.5">
        {ROWS.map((r) => (
          <div key={r.id} className="relative h-10 rounded-control bg-sunken">
            <div className="absolute inset-y-0 rounded-control bg-avail/25" style={{ left: `${r.avail[0] * 100}%`, width: `${(r.avail[1] - r.avail[0]) * 100}%` }} />
            {r.shifts.map((s, i) => (
              <div key={i} className="absolute inset-y-1 flex items-center rounded-[6px] px-2.5 text-[11px] font-medium text-white" style={{ left: `${s.a * 100}%`, width: `${(s.b - s.a) * 100}%`, background: s.c }}>{s.t}</div>
            ))}
          </div>
        ))}
      </div>
      <p className="mt-4 flex items-center gap-2 text-xs text-mute">
        <span className="inline-block h-3 w-5 rounded-sm bg-avail/25" />{t('员工报的可用时间')}
        <span className="ml-3 inline-block h-3 w-5 rounded-sm bg-accent" />{t('店长排的班次')}
      </p>
    </div>
  )
}

export default function Landing() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [code, setCode] = useState('')
  const toast = useToast()
  // 从别的页面带过来的一次性提示（例如注销账号成功）
  useEffect(() => {
    try {
      const msg = sessionStorage.getItem('shift-flash')
      if (msg) { sessionStorage.removeItem('shift-flash'); toast(msg) }
    } catch { /* ignore */ }
  }, [toast])

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col px-4 sm:px-6">
      {/* 首屏正文里已经有放大的品牌标识，页头不再重复放一个小的 */}
      <header className="flex h-16 items-center justify-end gap-2">
        <LangSwitch />
        {user
          ? <Link to="/go" className="rounded-control px-2.5 py-1.5 text-sm font-medium text-accent hover:bg-accent-soft">{t('进入我的页面')}</Link>
          : <Link to="/auth" className="rounded-control px-2.5 py-1.5 text-sm font-medium text-mute hover:bg-sunken hover:text-ink">{t('登录')}</Link>}
      </header>

      <main className="grid flex-1 items-center gap-12 pb-16 pt-4 lg:grid-cols-[1fr_1.05fr] lg:gap-20">
        <div>
          <h1><Logo className="text-[clamp(2.5rem,6.5vw,4.25rem)]" /></h1>
          <p className="mt-6 max-w-[34rem] break-keep text-lg leading-relaxed text-balance text-mute">{t('员工在线报班，店长在时间轴上拖拽排班，发布后员工一键导入日历。')}</p>
          <Button variant="primary" className="mt-8 h-12 w-full px-6 text-base sm:w-auto" onClick={() => nav('/auth?role=manager&mode=signup')}>
            {t('我是店长')}<ArrowRight size={18} />
          </Button>

          <form
            className="mt-10 max-w-[34rem] rounded-panel border border-line bg-surface p-4 lg:max-w-md"
            onSubmit={(e) => { e.preventDefault(); const c = code.trim(); if (c) nav(`/s/${c}`) }}
          >
            <label className="block text-sm font-semibold" htmlFor="code">{t('我是员工，用店铺码报班')}</label>
            <div className="mt-3 flex gap-2">
              <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder={t('向店长要店铺码或链接')} />
              <Button type="submit" variant="secondary" disabled={!code.trim()}>{t('进入')}</Button>
            </div>
            <p className="mt-2.5 text-xs leading-relaxed text-mute">{t('不用注册也能报班。注册后可以查看班表并导入日历。')}</p>
          </form>
        </div>
        <TimelinePreview />
      </main>

      {api.mode === 'demo' && (
        <footer className="pb-6">
          <p className="mx-auto w-fit max-w-full rounded-full bg-accent-soft px-4 py-1.5 text-center text-xs text-accent">
            {t('演示模式：还没连接 Supabase，数据只保存在这个浏览器。演示店铺码：')}
            <button className="num font-semibold underline" onClick={() => setCode(DEMO_SHOP_CODE)}>{DEMO_SHOP_CODE}</button>
          </p>
        </footer>
      )}
    </div>
  )
}
