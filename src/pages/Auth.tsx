import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Field, Input, Logo, Segmented } from '../components/ui'
import { api } from '../data'
import { DEMO_ACCOUNTS } from '../data/demoApi'
import { useAuth } from '../auth/AuthContext'
import { errMsg } from '../lib/errors'
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
  return <div className="grid min-h-[100dvh] place-items-center text-sm text-mute">正在进入...</div>
}

export default function Auth() {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const { user } = useAuth()
  const next = params.get('next')
  const [mode, setMode] = useState<'login' | 'signup'>(params.get('mode') === 'signup' ? 'signup' : 'login')
  const [role, setRole] = useState<Role>(params.get('role') === 'staff' ? 'staff' : 'manager')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { if (user) nav(next || '/go', { replace: true }) }, [user, next, nav])

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError(null)
    try { await fn() } catch (e) { setError(errMsg(e)) } finally { setBusy(false) }
  }
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    run(() => (mode === 'signup' ? api.signUp(email.trim(), password, role) : api.signIn(email.trim(), password)))
  }

  return (
    <div className="grid min-h-[100dvh] place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Link to="/"><Logo className="mb-8 text-lg" /></Link>
        <h1 className="text-2xl font-semibold tracking-tight">{mode === 'login' ? '登录' : '创建账号'}</h1>
        <div className="mt-5"><Segmented value={mode} onChange={(m) => { setMode(m); setError(null) }} options={[{ value: 'login', label: '登录' }, { value: 'signup', label: '注册' }]} /></div>

        <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
          {mode === 'signup' && (
            <Field label="我的身份">
              <Segmented value={role} onChange={setRole} options={[{ value: 'manager', label: '店长' }, { value: 'staff', label: '员工' }]} />
            </Field>
          )}
          <Field label="邮箱"><Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="密码" hint={mode === 'signup' ? '至少 6 位' : undefined}>
            <Input type="password" required minLength={6} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          {error && <p className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{error}</p>}
          <Button type="submit" variant="primary" disabled={busy} className="h-11">{busy ? '请稍候...' : mode === 'login' ? '登录' : '注册'}</Button>
        </form>

        {api.mode === 'demo' && (
          <div className="mt-8 rounded-panel border border-dashed border-line p-4">
            <p className="text-sm font-medium">演示模式：一键体验</p>
            <p className="mt-1 text-xs text-mute">未连接 Supabase，数据只保存在这个浏览器里。</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => run(() => api.signIn(DEMO_ACCOUNTS.manager.email, DEMO_ACCOUNTS.manager.password))}>以店长进入</Button>
              <Button size="sm" onClick={() => run(() => api.signIn(DEMO_ACCOUNTS.staff.email, DEMO_ACCOUNTS.staff.password))}>以员工「林晓」进入</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
