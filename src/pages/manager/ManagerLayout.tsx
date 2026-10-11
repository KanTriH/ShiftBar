import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Button, Field, Input, Logo, Skeleton, cn, useToast } from '../../components/ui'
import { api } from '../../data'
import { useAuth } from '../../auth/AuthContext'
import { errMsg } from '../../lib/errors'
import type { Location, Member, MemberPosition, Position, Shop } from '../../lib/types'
import { isStaffInWrongPlace } from '../../lib/landing'
import { POSITION_PRESETS } from '../../lib/types'
import { LangSwitch } from '../../i18n'
import { translate as t } from '../../i18n/core'

interface ManagerCtx {
  shop: Shop
  setShop: (s: Shop) => void
  locations: Location[]
  positions: Position[]
  members: Member[]
  /** 员工 id -> 会的岗位 id（技能矩阵）。没勾过任何岗位的员工没有这一项 */
  skills: Map<string, Set<string>>
  /** 勾选 / 取消一个员工会的岗位（先更新界面，失败再回滚） */
  setSkill: (memberId: string, positionId: string, on: boolean) => Promise<void>
  reloadLocations: () => Promise<void>
  reloadPositions: () => Promise<void>
  reloadMembers: () => Promise<void>
}
const Ctx = createContext<ManagerCtx | null>(null)
export const useManager = () => useContext(Ctx)!

const TABS = [
  { to: '/manager', end: true, label: '排班' },
  { to: '/manager/availability', end: false, label: '可用时间' },
  { to: '/manager/staff', end: false, label: '员工' },
  { to: '/manager/settings', end: false, label: '设置' },
]

export default function ManagerLayout() {
  const { user, loading } = useAuth()
  const nav = useNavigate()
  const [shop, setShop] = useState<Shop | null | undefined>(undefined)
  const [locations, setLocations] = useState<Location[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [memberPositions, setMemberPositions] = useState<MemberPosition[]>([])

  useEffect(() => {
    if (loading) return
    if (!user) { nav('/auth?role=manager&next=/manager', { replace: true }); return }
    let alive = true
    ;(async () => {
      try {
        const owned = await api.getOwnedShop()
        if (!alive) return
        // 没有自己的店铺：如果其实是已经绑定了店铺的员工（比如从 /manager 的地址进来、登录后被带回这里），
        // 就送去员工页，而不是让 TA 看到"创建你的店铺"
        if (!owned && isStaffInWrongPlace({ hasOwnedShop: false, hasMembership: !!(await api.getMembership()) })) {
          if (alive) nav('/me', { replace: true })
          return
        }
        if (alive) setShop(owned)
      } catch { if (alive) setShop(null) }
    })()
    return () => { alive = false }
  }, [user, loading, nav])

  const reloadLocations = useCallback(async () => { if (shop) setLocations(await api.listLocations(shop.id)) }, [shop])
  const reloadPositions = useCallback(async () => { if (shop) setPositions(await api.listPositions(shop.id)) }, [shop])
  const reloadMembers = useCallback(async () => { if (shop) setMembers(await api.listMembers(shop.id)) }, [shop])
  const reloadSkills = useCallback(async () => { if (shop) setMemberPositions(await api.listMemberPositions(shop.id)) }, [shop])
  useEffect(() => { reloadLocations(); reloadPositions(); reloadMembers(); reloadSkills().catch(() => {}) }, [reloadLocations, reloadPositions, reloadMembers, reloadSkills])

  const skills = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const r of memberPositions) {
      if (!m.has(r.member_id)) m.set(r.member_id, new Set())
      m.get(r.member_id)!.add(r.position_id)
    }
    return m
  }, [memberPositions])
  const setSkill = useCallback(async (memberId: string, positionId: string, on: boolean) => {
    if (!shop) return
    setMemberPositions((cur) => {
      const rest = cur.filter((r) => !(r.member_id === memberId && r.position_id === positionId))
      return on ? [...rest, { member_id: memberId, position_id: positionId }] : rest
    })
    try { await api.setMemberPosition(shop.id, memberId, positionId, on) } catch (e) { await reloadSkills().catch(() => {}); throw e }
  }, [shop, reloadSkills])

  if (shop === undefined) return <div className="mx-auto max-w-6xl p-6"><Skeleton className="h-10 w-56" /><Skeleton className="mt-6 h-80" /></div>
  if (shop === null) return <Onboarding onCreated={setShop} />

  return (
    <Ctx.Provider value={{ shop, setShop, locations, positions, members, skills, setSkill, reloadLocations, reloadPositions, reloadMembers }}>
      <div className="min-h-[100dvh]">
        <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur print:hidden">
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 sm:h-[68px] sm:flex-nowrap sm:px-6 sm:py-0">
            <Link to="/"><Logo className="text-xl" /></Link>
            <span className="text-faint">/</span>
            <span className="min-w-0 max-w-[10rem] truncate text-sm font-semibold max-sm:flex-1">{shop.name}</span>
            <nav className="thin-scroll order-last -mx-1 flex basis-full gap-1 overflow-x-auto pb-1 sm:order-none sm:mx-0 sm:ml-1 sm:min-w-0 sm:flex-1 sm:basis-auto sm:pb-0" aria-label={t('主导航')}>
              {TABS.map(({ to, end, label }) => (
                <NavLink key={to} to={to} end={end}
                  className={({ isActive }) => cn('press flex h-10 shrink-0 items-center rounded-full px-4 text-sm font-semibold', isActive ? 'bg-ink text-bg' : 'text-mute hover:bg-sunken hover:text-ink')}>
                  {t(label)}
                </NavLink>
              ))}
            </nav>
            <LangSwitch />
            <button className="press px-1 text-sm font-medium text-mute hover:text-ink" onClick={async () => { await api.signOut(); nav('/') }}>{t('退出')}</button>
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
        <h1 className="text-2xl font-semibold tracking-tight">{t('创建你的店铺')}</h1>
        <p className="mt-2 text-sm text-mute">{t('先起个名字，其余的营业时间和员工稍后都能改。')}</p>
        <form onSubmit={submit} className="mt-6 flex flex-col gap-5">
          <Field label={t('店铺名称')}><Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} autoFocus /></Field>
          <fieldset>
            <legend className="mb-2 text-[13px] font-medium">{t('岗位标签（可以随时增删改）')}</legend>
            <div className="flex flex-col gap-2">
              {POSITION_PRESETS.map((p, i) => (
                <label key={p.label} className={cn('press flex cursor-pointer items-center justify-between rounded-control border px-3 py-2.5 text-sm', preset === i ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:bg-sunken')}>
                  <span className="flex items-center gap-2"><input type="radio" name="preset" checked={preset === i} onChange={() => setPreset(i)} className="accent-[var(--accent)]" />{t(p.label)}</span>
                  <span className="num text-xs text-mute">{p.items.join(' / ')}</span>
                </label>
              ))}
              <label className={cn('press flex cursor-pointer items-center gap-2 rounded-control border px-3 py-2.5 text-sm', preset === -1 ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:bg-sunken')}>
                <input type="radio" name="preset" checked={preset === -1} onChange={() => setPreset(-1)} className="accent-[var(--accent)]" />{t('我自己来定义')}
              </label>
            </div>
          </fieldset>
          <Button type="submit" variant="primary" className="h-11" disabled={busy || !name.trim()}>{busy ? t('创建中...') : t('创建店铺')}</Button>
        </form>
        <p className="mt-6 text-sm text-mute">
          {t('你是员工，不是店长？')}<Link to="/me" className="font-medium text-accent">{t('用店铺码绑定店铺')}</Link>
        </p>
      </div>
    </div>
  )
}
