import { useState } from 'react'
import { Warning } from '@phosphor-icons/react'
import { Button, Field, Input, Modal } from './ui'
import { api } from '../data'
import { errMsg } from '../lib/errors'
import { translate as t } from '../i18n/core'

interface Props {
  open: boolean
  onClose: () => void
  email: string
  role: 'manager' | 'staff'
  /** 店长：自己的店铺名；员工：所在店铺名（可能还没绑定） */
  shopName?: string
  /** 店长：店里的员工人数 */
  staffCount?: number
}

/** 彻底注销账号：说明后果，并要求输入自己的邮箱确认 */
export function DeleteAccountModal({ open, onClose, email, role, shopName, staffCount }: Props) {
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const matches = typed.trim().toLowerCase() === email.toLowerCase()

  const close = () => { if (busy) return; setTyped(''); setError(null); onClose() }
  const confirm = async () => {
    setBusy(true); setError(null)
    try {
      await api.deleteAccount()
      // 账号没了以后，各页面会因为"已退出"各自跳去登录页，和这里的跳转抢先；
      // 所以整页跳转到首页，并把提示留给首页显示一次
      try { sessionStorage.setItem('shift-flash', t('账号已注销，相关数据已删除')) } catch { /* ignore */ }
      window.location.replace('/')
    } catch (e) { setError(errMsg(e)); setBusy(false) }
  }

  return (
    <Modal open={open} onClose={close} title={t('注销账号')}>
      <div className="flex flex-col gap-4">
        <p className="flex items-start gap-2 rounded-control bg-danger/10 px-3 py-2.5 text-sm text-danger">
          <Warning size={18} weight="fill" className="mt-0.5 shrink-0" />
          <span>{t('这个操作无法恢复。')}</span>
        </p>

        {role === 'manager' ? (
          <div className="flex flex-col gap-2 text-sm text-mute">
            <p>{shopName ? t('注销后，你的店铺「{shop}」和里面的全部数据会被永久删除：', { shop: shopName }) : t('注销后，你名下的店铺和里面的全部数据会被永久删除：')}</p>
            <ul className="list-disc pl-5">
              <li>{t('所有门店、岗位、营业时间设置')}</li>
              <li>{staffCount ? t('{n} 位员工的记录、他们的报班和所有已排班次', { n: staffCount }) : t('员工记录、报班和所有已排班次')}</li>
              <li>{t('当日任务和发布记录')}</li>
            </ul>
            <p>{t('员工自己的账号不会被删除，但他们将看不到班表。建议先导出 PDF 留档。')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 text-sm text-mute">
            <p>{shopName ? t('注销后，你的登录账号，以及你在「{shop}」里的员工记录、报班和已排班次都会被永久删除。', { shop: shopName }) : t('注销后，你的登录账号以及相关的员工记录、报班和已排班次都会被永久删除。')}</p>
            <p>{t('店长将不再看到你，已发布班表里属于你的班次也会消失。')}</p>
          </div>
        )}

        <Field label={t('输入你的邮箱来确认：{email}', { email })}>
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" placeholder={email} />
        </Field>
        {error && <p className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button onClick={close} disabled={busy}>{t('取消')}</Button>
          <Button variant="primary" className="!bg-danger !text-white" onClick={confirm} disabled={!matches || busy}>{busy ? t('注销中...') : t('永久注销账号')}</Button>
        </div>
      </div>
    </Modal>
  )
}
