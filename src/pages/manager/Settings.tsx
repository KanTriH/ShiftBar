import { useState } from 'react'
import { Copy, Plus, Trash } from '@phosphor-icons/react'
import { Button, Field, Input, cn, useToast } from '../../components/ui'
import { useManager } from './ManagerLayout'
import { api } from '../../data'
import { errMsg } from '../../lib/errors'
import type { Location, Position, WeekHours } from '../../lib/types'
import { SettingsTabs } from './ScheduleSettings'
import { POSITION_COLORS } from '../../lib/types'
import { DAY_LABELS, fmtMin, parseHM } from '../../lib/time'

export default function Settings() {
  const { shop, setShop, locations, positions, reloadLocations, reloadPositions } = useManager()
  const toast = useToast()
  const link = `${window.location.origin}/s/${shop.code}`

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast('已复制') } catch { toast('复制失败，请手动选中复制') }
  }
  const saveShop = async (patch: { name?: string; hours?: WeekHours }) => {
    try { await api.updateShop(shop.id, patch); setShop({ ...shop, ...patch }) } catch (e) { toast(errMsg(e)) }
  }
  const setDay = (i: number, v: WeekHours[number]) => saveShop({ hours: shop.hours.map((h, j) => (j === i ? v : h)) })

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-10">
      <SettingsTabs />

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold">员工报班链接</h2>
        <p className="-mt-2 text-sm text-mute">发给员工，打开就能填，不用注册。</p>
        <div className="flex gap-2">
          <Input readOnly value={link} onFocus={(e) => e.target.select()} className="num" aria-label="报班链接" />
          <Button onClick={() => copy(link)}><Copy size={16} />复制</Button>
        </div>
        <p className="text-sm text-mute">店铺码：<button className="num font-semibold text-ink underline decoration-line underline-offset-2" onClick={() => copy(shop.code)}>{shop.code}</button>（员工注册后凭它绑定店铺）</p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold">店铺信息</h2>
        <Field label="店铺名称"><Input defaultValue={shop.name} maxLength={60} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== shop.name && saveShop({ name: e.target.value.trim() })} /></Field>
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-base font-semibold">门店</h2>
          <p className="mt-1 text-sm text-mute">有多家门店、员工是同一批人的话，在这里添加。排班时按门店分别排，员工报班时可以选自己能去哪几家。只有一家门店时，这些选项不会出现。</p>
        </div>
        <ul className="divide-y divide-line rounded-panel border border-line bg-surface">
          {locations.map((l) => <LocationRow key={l.id} l={l} canDelete={locations.length > 1} onChanged={reloadLocations} />)}
        </ul>
        <AddLocation shopId={shop.id} onAdded={reloadLocations} />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-base font-semibold">营业时间</h2>
            <p className="mt-1 text-sm text-mute">排班时间轴和员工可填的范围以此为准。</p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => saveShop({ hours: shop.hours.map(() => shop.hours[0] ?? { open: 540, close: 1320 }) })}>周一同步到全周</Button>
        </div>
        <ul className="divide-y divide-line rounded-panel border border-line bg-surface">
          {shop.hours.map((h, i) => (
            <li key={i} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
              <span className="w-10 text-sm font-medium">{DAY_LABELS[i]}</span>
              <label className="flex items-center gap-2 text-sm text-mute">
                <input type="checkbox" checked={!h} onChange={(e) => setDay(i, e.target.checked ? null : { open: 540, close: 1320 })} className="accent-[var(--accent)]" />休息
              </label>
              {h && (
                <div className="ml-auto flex items-center gap-2">
                  <input type="time" step={900} value={fmtMin(h.open)} aria-label={`${DAY_LABELS[i]}开门`} onChange={(e) => e.target.value && parseHM(e.target.value) < h.close && setDay(i, { ...h, open: parseHM(e.target.value) })} className="num h-9 rounded-control border border-line bg-bg px-2 text-sm" />
                  <span className="text-faint">-</span>
                  <input type="time" step={900} value={fmtMin(h.close)} aria-label={`${DAY_LABELS[i]}关门`} onChange={(e) => e.target.value && parseHM(e.target.value, true) > h.open && setDay(i, { ...h, close: parseHM(e.target.value, true) })} className="num h-9 rounded-control border border-line bg-bg px-2 text-sm" />
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-base font-semibold">岗位标签</h2>
          <p className="mt-1 text-sm text-mute">每家店的分工不同，名字和颜色都可以自己定。排班时不同岗位用不同颜色区分。</p>
        </div>
        <ul className="divide-y divide-line rounded-panel border border-line bg-surface">
          {positions.map((p) => <PositionRow key={p.id} p={p} onChanged={reloadPositions} />)}
          {positions.length === 0 && <li className="px-4 py-6 text-sm text-mute">还没有岗位标签，在下面添加第一个。</li>}
        </ul>
        <AddPosition shopId={shop.id} used={positions.length} onAdded={reloadPositions} />
      </section>
    </div>
  )
}

function LocationRow({ l, canDelete, onChanged }: { l: Location; canDelete: boolean; onChanged: () => Promise<void> }) {
  const toast = useToast()
  const rename = async (v: string) => { try { await api.updateLocation(l.id, { name: v }); await onChanged() } catch (e) { toast(errMsg(e)) } }
  const remove = async () => {
    if (!window.confirm(`删除门店「${l.name}」？这家门店已排的班次和当日任务会一起删除，无法恢复。`)) return
    try { await api.deleteLocation(l.id); await onChanged() } catch (e) { toast(errMsg(e)) }
  }
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <input defaultValue={l.name} maxLength={60} aria-label="门店名称" onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== l.name && rename(e.target.value.trim())}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        className="h-8 min-w-0 flex-1 rounded-control bg-transparent px-2 text-sm font-medium hover:bg-sunken focus:bg-sunken focus:outline-none" />
      {canDelete && <button onClick={remove} aria-label={`删除 ${l.name}`} className="press rounded p-1.5 text-faint hover:bg-sunken hover:text-danger"><Trash size={16} /></button>}
    </li>
  )
}

function AddLocation({ shopId, onAdded }: { shopId: string; onAdded: () => Promise<void> }) {
  const toast = useToast()
  const [name, setName] = useState('')
  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    const n = name.trim(); if (!n) return
    try { await api.createLocation(shopId, n); setName(''); await onAdded() } catch (err) { toast(errMsg(err)) }
  }
  return (
    <form onSubmit={add} className="flex gap-2">
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="新门店名称，例如 北区店" maxLength={60} aria-label="新门店名称" />
      <Button type="submit" disabled={!name.trim()}><Plus size={16} />添加</Button>
    </form>
  )
}

function PositionRow({ p, onChanged }: { p: Position; onChanged: () => Promise<void> }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const patch = async (v: { name?: string; color?: string }) => { try { await api.updatePosition(p.id, v); await onChanged() } catch (e) { toast(errMsg(e)) } }
  const remove = async () => {
    if (!window.confirm(`删除岗位「${p.name}」？用到它的班次会变成「未指定岗位」。`)) return
    try { await api.deletePosition(p.id); await onChanged() } catch (e) { toast(errMsg(e)) }
  }
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-2.5">
      <button onClick={() => setOpen(!open)} aria-label="更换颜色" aria-expanded={open} className="press h-6 w-6 shrink-0 rounded-full ring-2 ring-line ring-offset-2 ring-offset-surface" style={{ background: p.color }} />
      <input defaultValue={p.name} maxLength={30} aria-label="岗位名称" onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== p.name && patch({ name: e.target.value.trim() })}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        className="h-8 min-w-0 flex-1 rounded-control bg-transparent px-2 text-sm font-medium hover:bg-sunken focus:bg-sunken focus:outline-none" />
      <button onClick={remove} aria-label={`删除 ${p.name}`} className="press rounded p-1.5 text-faint hover:bg-sunken hover:text-danger"><Trash size={16} /></button>
      {open && (
        <div className="flex w-full flex-wrap gap-2 pt-1">
          {POSITION_COLORS.map((c) => (
            <button key={c} onClick={() => { patch({ color: c }); setOpen(false) }} aria-label={`颜色 ${c}`} className={cn('press h-7 w-7 rounded-full', p.color === c && 'ring-2 ring-ink ring-offset-2 ring-offset-surface')} style={{ background: c }} />
          ))}
        </div>
      )}
    </li>
  )
}

function AddPosition({ shopId, used, onAdded }: { shopId: string; used: number; onAdded: () => Promise<void> }) {
  const toast = useToast()
  const [name, setName] = useState('')
  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    const n = name.trim(); if (!n) return
    try { await api.createPosition(shopId, n, POSITION_COLORS[used % POSITION_COLORS.length]); setName(''); await onAdded() } catch (err) { toast(errMsg(err)) }
  }
  return (
    <form onSubmit={add} className="flex gap-2">
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="新岗位，例如 bar" maxLength={30} aria-label="新岗位名称" />
      <Button type="submit" disabled={!name.trim()}><Plus size={16} />添加</Button>
    </form>
  )
}
