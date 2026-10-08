import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/ui'
import { DeleteAccountModal } from '../../components/DeleteAccountModal'
import { useManager } from './ManagerLayout'
import { SettingsTabs } from './ScheduleSettings'
import { useAuth } from '../../auth/AuthContext'
import { translate as t } from '../../i18n/core'

export default function AccountSettings() {
  const { user } = useAuth()
  const { shop, members } = useManager()
  const [open, setOpen] = useState(false)

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-10">
      <SettingsTabs />

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">{t('登录账号')}</h2>
        <p className="text-sm text-mute">{t('当前登录：')}<span className="font-medium text-ink">{user?.email}</span></p>
        <div><Link to="/reset-password"><Button>{t('修改密码')}</Button></Link></div>
      </section>

      <section className="flex flex-col gap-3 rounded-panel border border-danger/40 p-5">
        <h2 className="text-base font-semibold text-danger">{t('注销账号')}</h2>
        <p className="text-sm text-mute">{t('永久删除你的账号，以及你名下的店铺和里面的全部数据（门店、员工记录、报班、班次等）。无法恢复，建议先导出 PDF 留档。')}</p>
        <div><Button variant="danger" onClick={() => setOpen(true)}>{t('注销账号...')}</Button></div>
      </section>

      {user && <DeleteAccountModal open={open} onClose={() => setOpen(false)} email={user.email} role="manager" shopName={shop.name} staffCount={members.length} />}
    </div>
  )
}
