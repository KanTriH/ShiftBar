import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Field, Input, Logo, Skeleton } from '../components/ui'
import { AvailabilityForm } from '../components/AvailabilityForm'
import { api } from '../data'
import { useAuth } from '../auth/AuthContext'
import type { PublicShop } from '../lib/types'
import { addDays } from '../lib/time'

const NAME_KEY = 'shift-guest-name'

export default function GuestPage() {
  const { code = '' } = useParams()
  const { user } = useAuth()
  const [shop, setShop] = useState<PublicShop | null | undefined>(undefined)
  const [name, setName] = useState(() => { try { return localStorage.getItem(NAME_KEY) ?? '' } catch { return '' } })
  const [debounced, setDebounced] = useState(name)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => { api.getPublicShop(code).then(setShop).catch(() => setShop(null)) }, [code])
  useEffect(() => { const t = setTimeout(() => setDebounced(name.trim()), 400); return () => clearTimeout(t) }, [name])
  useEffect(() => { try { localStorage.setItem(NAME_KEY, name) } catch { /* ignore */ } }, [name])

  const claimedHit = shop?.members.find((m) => m.claimed && m.name.toLowerCase() === name.trim().toLowerCase())

  return (
    <div className="mx-auto min-h-[100dvh] w-full max-w-2xl px-4 pb-8 sm:px-6">
      <header className="flex h-16 items-center justify-between">
        <Link to="/"><Logo /></Link>
        {user ? <Link to="/go" className="text-sm font-medium text-accent">我的页面</Link> : <Link to={`/auth?role=staff&mode=signup&next=/s/${code}`} className="text-sm font-medium text-mute hover:text-ink">登录 / 注册</Link>}
      </header>

      {shop === undefined ? (
        <div className="flex flex-col gap-3 pt-4"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
      ) : shop === null ? (
        <div className="pt-10">
          <h1 className="text-2xl font-semibold">找不到这家店铺</h1>
          <p className="mt-2 text-sm text-mute">链接或店铺码可能输错了，请向店长再确认一下。</p>
          <Link to="/" className="mt-4 inline-block text-sm font-medium text-accent">回到首页</Link>
        </div>
      ) : (
        <>
          <h1 className="pt-4 text-3xl font-semibold tracking-tight">{shop.name}</h1>
          <p className="mt-2 text-sm text-mute">告诉店长你哪些时间可以上班。不用注册，用名字就能填，之后还能回来修改。</p>

          <div className="mt-6">
            {user ? (
              <p className="rounded-control bg-accent-soft px-3 py-2 text-sm text-accent">已登录，将以你的员工身份提交。如果还没绑定店铺，请先到「我的页面」输入店铺码。</p>
            ) : (
              <Field label="你的名字" error={claimedHit ? '这个名字已被注册员工使用，请登录后填写，或换一个名字' : null}>
                <Input value={name} onChange={(e) => { setName(e.target.value); setSubmitted(false) }} list="known-names" placeholder="和店长排班表上的名字一致" maxLength={30} autoComplete="name" />
                <datalist id="known-names">{shop.members.filter((m) => !m.claimed).map((m) => <option key={m.name} value={m.name} />)}</datalist>
              </Field>
            )}
          </div>

          <div className="mt-6">
            <AvailabilityForm
              hours={shop.hours}
              canSubmit={!!user || (!!name.trim() && !claimedHit)}
              reloadKey={user ? 'user' : debounced}
              load={(ws) => (user ? loadMine(ws) : debounced ? api.getGuestAvailability(code, debounced, ws) : Promise.resolve([]))}
              save={(ws, entries) => api.submitAvailability(code, name, ws, entries)}
              onSaved={() => setSubmitted(true)}
            />
          </div>

          {submitted && !user && (
            <div className="pop mt-6 rounded-panel border border-line bg-surface p-4">
              <p className="text-sm font-medium">想在班表发布后直接查看自己的班次？</p>
              <p className="mt-1 text-sm text-mute">注册账号后，用同一个名字绑定，就能看到班表并导入手机日历。</p>
              <Link to={`/auth?role=staff&mode=signup&next=/me`} className="mt-3 inline-block text-sm font-medium text-accent">注册账号</Link>
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
