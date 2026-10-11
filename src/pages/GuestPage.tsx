import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Field, Input, Logo, Skeleton } from '../components/ui'
import { AvailabilityForm } from '../components/AvailabilityForm'
import { api } from '../data'
import { useAuth } from '../auth/AuthContext'
import type { PublicShop } from '../lib/types'
import { addDays } from '../lib/time'
import { LangSwitch } from '../i18n'
import { translate as t } from '../i18n/core'

const NAME_KEY = 'shift-guest-name'

export default function GuestPage() {
  const { code = '' } = useParams()
  const { user } = useAuth()
  const [shop, setShop] = useState<PublicShop | null | undefined>(undefined)
  const [name, setName] = useState(() => { try { return localStorage.getItem(NAME_KEY) ?? '' } catch { return '' } })
  const [debounced, setDebounced] = useState(name)
  const [submitted, setSubmitted] = useState(false)
  // 店长关掉店铺码绑定后，没有绑定过店铺的登录账号也只能像访客一样按名字报班
  const [bound, setBound] = useState(false)

  useEffect(() => { api.getPublicShop(code).then(setShop).catch(() => setShop(null)) }, [code])
  useEffect(() => { if (user) api.getMembership().then((ms) => setBound(!!ms)).catch(() => {}); else setBound(false) }, [user])
  useEffect(() => { const timer = setTimeout(() => setDebounced(name.trim()), 400); return () => clearTimeout(timer) }, [name])
  useEffect(() => { try { localStorage.setItem(NAME_KEY, name) } catch { /* ignore */ } }, [name])

  const asAccount = !!user && (shop?.claim_enabled !== false || bound)
  const claimedHit = shop?.members.find((m) => m.claimed && m.name.toLowerCase() === name.trim().toLowerCase())

  return (
    <div className="mx-auto min-h-[100dvh] w-full max-w-2xl px-4 pb-8 sm:px-6">
      <header className="flex h-16 items-center justify-between">
        <Link to="/"><Logo /></Link>
        <div className="flex items-center gap-2">
          <LangSwitch />
          {user ? <Link to="/go" className="text-sm font-medium text-accent">{t('我的页面')}</Link>
            : shop?.claim_enabled === false ? null
            : <Link to={`/auth?role=staff&mode=signup&next=/s/${code}`} className="text-sm font-medium text-mute hover:text-ink">{t('登录 / 注册')}</Link>}
        </div>
      </header>

      {shop === undefined ? (
        <div className="flex flex-col gap-3 pt-4"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
      ) : shop === null ? (
        <div className="pt-10">
          <h1 className="text-2xl font-semibold">{t('找不到这家店铺')}</h1>
          <p className="mt-2 text-sm text-mute">{t('链接或店铺码可能输错了，请向店长再确认一下。')}</p>
          <Link to="/" className="mt-4 inline-block text-sm font-medium text-accent">{t('回到首页')}</Link>
        </div>
      ) : (
        <>
          <h1 className="pt-4 text-3xl font-semibold tracking-tight">{t('{name}报班', { name: shop.name })}</h1>

          <div className="mt-6">
            {asAccount ? (
              <p className="rounded-control bg-accent-soft px-3 py-2 text-sm text-accent">{t('已登录，将以你的员工身份提交。如果还没绑定店铺，请先到「我的页面」输入店铺码。')}</p>
            ) : (
              <Field label={t('你的名字')} error={claimedHit ? t('这个名字已被注册员工使用，请登录后填写，或换一个名字') : null}>
                <Input value={name} onChange={(e) => { setName(e.target.value); setSubmitted(false) }} list="known-names" placeholder={t('和店长排班表上的名字一致')} maxLength={30} autoComplete="name" />
                <datalist id="known-names">{shop.members.filter((m) => !m.claimed).map((m) => <option key={m.name} value={m.name} />)}</datalist>
              </Field>
            )}
          </div>

          <div className="mt-6">
            <AvailabilityForm
              hours={shop.hours} locations={shop.locations} weekStartDay={shop.week_start} region={shop.region}
              canSubmit={asAccount || (!!name.trim() && !claimedHit)}
              reloadKey={asAccount ? 'user' : debounced}
              load={(ws) => (asAccount ? loadMine(ws) : debounced ? api.getGuestAvailability(code, debounced, ws) : Promise.resolve([]))}
              save={(ws, entries) => api.submitAvailability(code, name, ws, entries)}
              onSaved={() => setSubmitted(true)}
            />
          </div>

          {submitted && !user && shop.claim_enabled && (
            <div className="pop mt-6 rounded-panel border border-line bg-surface p-4">
              <p className="text-sm font-medium">{t('想在班表发布后直接查看自己的班次？')}</p>
              <p className="mt-1 text-sm text-mute">{t('注册账号后，用同一个名字绑定，就能看到班表并导入手机日历。')}</p>
              <Link to={`/auth?role=staff&mode=signup&next=/me`} className="mt-3 inline-block text-sm font-medium text-accent">{t('注册账号')}</Link>
            </div>
          )}
        </>
      )}
    </div>
  )

  async function loadMine(ws: string) {
    const ms = await api.getMembership()
    if (!ms) return []
    return api.listMyAvailability(ms.member.id, ws, addDays(ws, 6))
  }
}
