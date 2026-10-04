import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { CalendarBlank, GearSix, SignOut, Users, Clock } from '@phosphor-icons/react'
import { Button, Field, Input, Logo, Skeleton, cn, useToast } from '../../components/ui'
import { api } from '../../data'
import { useAuth } from '../../auth/AuthContext'
import { errMsg } from '../../lib/errors'
import type { Member, Position, Shop } from '../../lib/types'
import { POSITION_PRESETS } from '../../lib/types'

interface ManagerCtx {
  shop: Shop
  setShop: (s: Shop) => void
  positions: Position[]
  members: Member[]
  reloadPositions: () => Promise<void>
  reloadMembers: () => Promise<void>
}
const Ctx = createContext<ManagerCtx | null>(null)
export const useManager = () => useContext(Ctx)!

const TABS = [
  { to: '/manager', end: true, label: '排班', icon: CalendarBlank },
  { to: '/manager/availability', end: false, label: '可用时间', icon: Clock },
  { to: '/manager/staff', end: false, label: '员工', icon: Users },
  { to: '/manager/settings', end: false, label: '设置', icon: GearSix },
]

export default function ManagerLayout() {
  const { user, loading } = useAuth()
  const nav = useNavigate()
  const [shop, setShop] = useState<Shop | null | undefined>(undefined)
  const [positions, setPositions] = useState<Position[]>([])
  const [members, setMembers] = useState<Member[]>([])

  useEffect(() => {
    if (loading) return
    if (!user) { nav('/auth?role=manager&next=/manager', { replace: true }); return }
    api.getOwnedShop().then(setShop).catch(() => setShop(null))
  }, [user, loading, nav])

  const reloadPositions = useCallback(async () => { if (shop) setPositions(await api.listPositions(shop.id)) }, [shop])
  const reloadMembers = useCallback(async () => { if (shop) setMembers(await api.listMembers(shop.id)) }, [shop])
  useEffect(() => { reloadPositions(); reloadMembers() }, [reloadPositions, reloadMembers])

  if (shop === undefined) return <div className="mx-auto max-w-6xl p-6"><Skeleton className="h-10 w-56" /><Skeleton className="mt-6 h-80" /></div>
  if (shop === null) return <Onboarding onCreated={setShop} />

  return (
    <Ctx.Provider value={{ shop, setShop, positions, members, reloadPositions, reloadMembers }}>
      <div className="min-h-[100dvh]">
        <header className="sticky top-0 z-30 print:hidden border-b border-line bg-bg/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-4 px-4 sm:px-6">
            <Link to="/"><Logo /></Link>
            <span className="hidden h-5 w-px bg-line sm:block" />
            <span className="hidden truncate text-sm font-medium sm:block">{shop.name}</span>
            <nav className="thin-scroll ml-2 flex min-w-0 flex-1 gap-1 overflow-x-auto" aria-label="主导航">
              {TABS.map(({ to, end, label, icon: Icon }) => (
                <NavLink key={to} to={to} end={end}
                  className={({ isActive }) => cn('press flex h-8 shrink-0 items-center gap-1.5 rounded-control px-3 text-[13px] font-medium', isActive ? 'bg-accent-soft text-accent' : 'text-mute hover:bg-sunken hover:text-ink')}>
                  <Icon size={16} />{label}
                </NavLink>
              ))}
            </nav>
            <Button variant="ghost" size="sm" onClick={async () => { await api.signOut(); nav('/') }}><SignOut size={16} /><span className="hidden sm:inline">退出</span></Button>
          </div>
        </header>
        <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 print:max-w-none print:p-0"><Outlet /></main>
      </div>
    </Ctx.Provider>
  )
}

/* ---------- 第一次使用：创建店铺 ---------- */
function Onboarding({ onCreated }: { onCreated: (s: Shop) => void }) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [preset, setPreset] = useState(0)
  const [busy, setBusy] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true)
    try { onCreated(await api.createShop(name.trim(), preset >= 0 ? POSITION_PRESETS[preset].items : [])) } catch (err) { toast(errMsg(err)) } finally { setBusy(false) }
  }
  return (
    <div className="grid min-h-[100dvh] place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <Logo className="mb-8 text-lg" />
        <h1 className="text-2xl font-semibold tracking-tight">创建你的店铺</h1>
        <p className="mt-2 text-sm text-mute">先起个名字，其余的营业时间和员工稍后都能改。</p>
        <form onSubmit={submit} className="mt-6 flex flex-col gap-5">
          <Field label="店铺名称"><Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} autoFocus /></Field>
          <fieldset>
            <legend className="mb-2 text-[13px] font-medium">岗位标签（可以随时增删改）</legend>
            <div className="flex flex-col gap-2">
              {POSITION_PRESETS.map((p, i) => (
                <label key={p.label} className={cn('press flex cursor-pointer items-center justify-between rounded-control border px-3 py-2.5 text-sm', preset === i ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:bg-sunken')}>
                  <span className="flex items-center gap-2"><input type="radio" name="preset" checked={preset === i} onChange={() => setPreset(i)} className="accent-[var(--accent)]" />{p.label}</span>
                  <span className="num text-xs text-mute">{p.items.join(' / ')}</span>
                </label>
              ))}
              <label className={cn('press flex cursor-pointer items-center gap-2 rounded-control border px-3 py-2.5 text-sm', preset === -1 ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:bg-sunken')}>
                <input type="radio" name="preset" checked={preset === -1} onChange={() => setPreset(-1)} className="accent-[var(--accent)]" />我自己来定义
              </label>
            </div>
          </fieldset>
          <Button type="submit" variant="primary" className="h-11" disabled={busy || !name.trim()}>{busy ? '创建中...' : '创建店铺'}</Button>
        </form>
        <p className="mt-6 text-sm text-mute">
          你是员工，不是店长？<Link to="/me" className="font-medium text-accent">用店铺码绑定店铺</Link>
        </p>
      </div>
    </div>
  )
}
