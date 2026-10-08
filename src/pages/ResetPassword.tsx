import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Field, Input, Logo, Skeleton, useToast } from '../components/ui'
import { api } from '../data'
import { useAuth } from '../auth/AuthContext'
import { errMsg } from '../lib/errors'
import { LangSwitch } from '../i18n'
import { translate as t } from '../i18n/core'

/**
 * 重置密码页。邮件里的链接会带着一次性的"恢复登录状态"回到这里，
 * supabase-js 读到链接后自动登录，所以这里只要有登录用户就可以设置新密码。
 * 已登录的用户也可以直接来这里修改密码。
 */
export default function ResetPassword() {
  const { user, loading } = useAuth()
  const nav = useNavigate()
  const toast = useToast()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 6) { setError(t('密码至少 6 位')); return }
    if (password !== confirm) { setError(t('两次输入的密码不一致')); return }
    setBusy(true); setError(null)
    try {
      await api.updatePassword(password)
      setDone(true)
      toast(t('密码已更新'))
    } catch (err) { setError(errMsg(err)) } finally { setBusy(false) }
  }

  return (
    <div className="grid min-h-[100dvh] place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-between"><Link to="/"><Logo className="text-lg" /></Link><LangSwitch /></div>

        {loading ? (
          <div className="flex flex-col gap-3"><Skeleton className="h-8 w-40" /><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
        ) : done ? (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">{t('密码已更新')}</h1>
            <p className="mt-2 text-sm text-mute">{t('下次登录请使用新密码。')}</p>
            <Button variant="primary" className="mt-6 h-11 w-full" onClick={() => nav('/go')}>{t('进入我的页面')}</Button>
          </>
        ) : !user ? (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">{t('链接已失效')}</h1>
            <p className="mt-2 text-sm text-mute">{t('重置链接只能使用一次，并且有时效。请重新申请一封重置邮件。')}</p>
            <Link to="/auth" className="mt-6 inline-block text-sm font-medium text-accent">{t('回到登录页')}</Link>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">{t('设置新密码')}</h1>
            <p className="mt-2 text-sm text-mute">{t('账号：{email}', { email: user.email })}</p>
            <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
              <Field label={t('新密码')} hint={t('至少 6 位')}>
                <Input type="password" required minLength={6} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
              <Field label={t('再输入一次')}>
                <Input type="password" required minLength={6} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </Field>
              {error && <p className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{error}</p>}
              <Button type="submit" variant="primary" disabled={busy} className="h-11">{busy ? t('请稍候...') : t('更新密码')}</Button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
