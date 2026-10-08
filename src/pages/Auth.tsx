import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Field, Input, Logo, Segmented } from '../components/ui'
import { api } from '../data'
import { DEMO_ACCOUNTS } from '../data/demoApi'
import { useAuth } from '../auth/AuthContext'
import { errMsg } from '../lib/errors'
import { LangSwitch } from '../i18n'
import { translate as t } from '../i18n/core'
import type { Role } from '../lib/types'

/** 登录后按身份分流：有店铺去店长页，是员工去员工页 */
export function Redirector() {
  const { user, loading } = useAuth()
  const nav = useNavigate()
  useEffect(() => {
    if (loading) return
    if (!user) { nav('/auth', { replace: true }); return }
    ;(async () => {
      if (await api.getOwnedShop()) return nav('/manager', { replace: true })
      if (await api.getMembership()) return nav('/me', { replace: true })
      nav(user.role === 'manager' ? '/manager' : '/me', { replace: true })
    })()
  }, [user, loading, nav])
  return <div className="grid min-h-[100dvh] place-items-center text-sm text-mute">{t('正在进入...')}</div>
}

type Mode = 'login' | 'signup' | 'forgot'

export default function Auth() {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const { user } = useAuth()
  const next = params.get('next')
  const [mode, setMode] = useState<Mode>(params.get('mode') === 'signup' ? 'signup' : 'login')
  const [role, setRole] = useState<Role>(params.get('role') === 'manager' ? 'manager' : 'staff')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resetSent, setResetSent] = useState(false)

  useEffect(() => { if (user) nav(next || '/go', { replace: true }) }, [user, next, nav])

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError(null)
    try { await fn() } catch (e) { setError(errMsg(e)) } finally { setBusy(false) }
  }
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    run(() => (mode === 'signup' ? api.signUp(email.trim(), password, role) : api.signIn(email.trim(), password)))
  }
  const sendReset = (e: React.FormEvent) => {
    e.preventDefault()
    // 不管这个邮箱有没有注册过都显示同样的结果，避免被人用来探测哪些邮箱注册过
    run(async () => { await api.requestPasswordReset(email.trim()); setResetSent(true) })
  }
  const goMode = (m: Mode) => { setMode(m); setError(null); setResetSent(false) }

  return (
    <div className="grid min-h-[100dvh] place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-between"><Link to="/"><Logo className="text-lg" /></Link><LangSwitch /></div>

        {mode === 'forgot' ? (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">{t('重置密码')}</h1>
            <p className="mt-2 text-sm text-mute">{t('输入注册时用的邮箱，我们会发一封带重置链接的邮件给你。')}</p>
            {resetSent ? (
              <div className="mt-6 rounded-panel border border-line bg-surface p-4" role="status">
                <p className="text-sm font-medium">{t('如果这个邮箱已注册，几分钟内会收到重置邮件。')}</p>
                <p className="mt-1 text-sm text-mute">{t('没收到的话，请看看垃圾邮件文件夹，或稍后再试一次。')}</p>
                {api.mode === 'demo' && <p className="mt-2 text-xs text-accent">{t('演示模式不会真的发邮件。')}</p>}
              </div>
            ) : (
              <form onSubmit={sendReset} className="mt-6 flex flex-col gap-4">
                <Field label={t('邮箱')}><Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
                {error && <p className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{error}</p>}
                <Button type="submit" variant="primary" disabled={busy} className="h-11">{busy ? t('请稍候...') : t('发送重置邮件')}</Button>
              </form>
            )}
            <button onClick={() => goMode('login')} className="mt-6 text-sm font-medium text-accent">{t('返回登录')}</button>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">{mode === 'login' ? t('登录') : t('创建账号')}</h1>
            <div className="mt-5"><Segmented value={mode} onChange={(m) => goMode(m)} options={[{ value: 'login', label: t('登录') }, { value: 'signup', label: t('注册') }]} /></div>

            <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
              {mode === 'signup' && (
                <Field label={t('我的身份')}>
                  <Segmented value={role} onChange={setRole} options={[{ value: 'manager', label: t('店长') }, { value: 'staff', label: t('员工') }]} />
                </Field>
              )}
              <Field label={t('邮箱')}><Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
              <Field label={t('密码')} hint={mode === 'signup' ? t('至少 6 位') : undefined}>
                <Input type="password" required minLength={6} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
              {mode === 'login' && (
                <button type="button" onClick={() => goMode('forgot')} className="-mt-2 self-start text-sm font-medium text-accent">{t('忘记密码？')}</button>
              )}
              {error && <p className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{error}</p>}
              <Button type="submit" variant="primary" disabled={busy} className="h-11">{busy ? t('请稍候...') : mode === 'login' ? t('登录') : t('注册')}</Button>
            </form>

            {api.mode === 'demo' && (
              <div className="mt-8 rounded-panel border border-dashed border-line p-4">
                <p className="text-sm font-medium">{t('演示模式：一键体验')}</p>
                <p className="mt-1 text-xs text-mute">{t('未连接 Supabase，数据只保存在这个浏览器里。')}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => run(() => api.signIn(DEMO_ACCOUNTS.manager.email, DEMO_ACCOUNTS.manager.password))}>{t('以店长进入')}</Button>
                  <Button size="sm" onClick={() => run(() => api.signIn(DEMO_ACCOUNTS.staff.email, DEMO_ACCOUNTS.staff.password))}>{t('以员工「林晓」进入')}</Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
