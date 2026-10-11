import { useState } from 'react'
import { Check, Trash, UserPlus } from '@phosphor-icons/react'
import { Badge, Button, Empty, Input, Segmented, cn, useToast } from '../../components/ui'
import { useManager } from './ManagerLayout'
import { api } from '../../data'
import { errMsg } from '../../lib/errors'
import { roleDot, roleStyle } from '../../lib/roles'
import type { Member, MemberStatus, Position } from '../../lib/types'
import { translate as t } from '../../i18n/core'

const COL_W = 84 // 技能矩阵每列的宽度（px）

export default function StaffList() {
  const { shop, members, positions, skills, setSkill, reloadMembers } = useManager()
  const toast = useToast()
  const [name, setName] = useState('')
  const [status, setStatus] = useState<MemberStatus>('regular')

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    const n = name.trim(); if (!n) return
    try { await api.createMember(shop.id, n, status); setName(''); await reloadMembers() } catch (err) { toast(errMsg(err).includes('duplicate') ? t('这个名字已经存在') : errMsg(err)) }
  }
  const setStatusOf = async (m: Member, s: MemberStatus) => { try { await api.updateMember(m.id, { status: s }); await reloadMembers() } catch (e) { toast(errMsg(e)) } }
  const rename = async (m: Member, v: string) => {
    const n = v.trim(); if (!n || n === m.name) return
    try { await api.updateMember(m.id, { name: n }); await reloadMembers() } catch (e) { toast(errMsg(e).includes('duplicate') ? t('这个名字已经存在') : errMsg(e)); await reloadMembers() }
  }
  const remove = async (m: Member) => {
    if (!window.confirm(t('删除「{name}」？TA 的报班和已排班次都会一起删除，无法恢复。', { name: m.name }))) return
    try { await api.deleteMember(m.id); await reloadMembers(); toast(t('已删除')) } catch (e) { toast(errMsg(e)) }
  }
  const toggle = async (m: Member, p: Position) => {
    try { await setSkill(m.id, p.id, !skills.get(m.id)?.has(p.id)) } catch (e) { toast(errMsg(e)) }
  }
  /** 点列头：这个岗位大家都会 -> 全部取消，否则全部勾上 */
  const toggleColumn = async (p: Position) => {
    const everyone = members.length > 0 && members.every((m) => skills.get(m.id)?.has(p.id))
    try { await Promise.all(members.map((m) => setSkill(m.id, p.id, !everyone))) } catch (e) { toast(errMsg(e)) }
  }

  const count = (p: Position) => members.filter((m) => skills.get(m.id)?.has(p.id)).length
  const grid = { gridTemplateColumns: `minmax(220px, 1fr) repeat(${positions.length}, ${COL_W}px)` }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t('员工')}</h1>
        <p className="mt-1 text-sm text-mute">{t('试工员工在排班表里会带「试工」标记。员工通过报班链接填写时，名字会自动加到这里。')}</p>
        <p className="mt-1 text-sm text-mute">{t('勾选每个人会的岗位。把员工排进他不会的岗位，这个班次会自动标成「培训」。一个岗位都没勾的员工不会被标培训。')}</p>
      </div>

      <form onSubmit={add} className="flex flex-wrap items-center gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('员工名字')} maxLength={30} className="min-w-[10rem] flex-1" aria-label={t('员工名字')} />
        <Segmented value={status} onChange={setStatus} options={[{ value: 'regular', label: t('正式') }, { value: 'trial', label: t('试工') }]} />
        <Button type="submit" variant="primary" disabled={!name.trim()}><UserPlus size={16} />{t('添加')}</Button>
      </form>

      {members.length === 0 ? <Empty title={t('还没有员工')} hint={t('在上面输入名字添加，或把报班链接发给员工。')} /> : (
        <div className="thin-scroll overflow-x-auto rounded-[22px] border border-line bg-surface">
          <div style={{ minWidth: 220 + positions.length * COL_W }}>
            {/* 表头：每个岗位一个岗位色胶囊，点一下整列勾选 / 取消 */}
            <div className="hidden items-center gap-x-0 border-b border-line bg-sunken px-4 py-2.5 md:grid" style={grid}>
              <span className="text-xs font-medium text-mute">{t('员工')}</span>
              {positions.map((p) => (
                <button key={p.id} onClick={() => toggleColumn(p)} title={t('点击：整列全选 / 取消')}
                  className="press mx-auto max-w-[76px] truncate rounded-full border px-2.5 py-1 text-xs font-semibold" style={roleStyle(p.color)}>{p.name}</button>
              ))}
            </div>

            <ul className="divide-y divide-line">
              {members.map((m) => (
                <li key={m.id} className="px-4 py-3">
                  <div className="grid items-center gap-y-2 md:gap-y-0" style={grid}>
                    <div className="flex min-w-0 flex-wrap items-center gap-2 max-md:col-span-full">
                      <input defaultValue={m.name} onBlur={(e) => rename(m, e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                        aria-label={t('{name} 的名字', { name: m.name })} maxLength={30}
                        className="h-9 min-w-0 flex-1 rounded-control bg-transparent px-2 text-sm font-semibold hover:bg-sunken focus:bg-sunken focus:outline-none" />
                      {m.user_id ? <Badge tone="accent">{t('已注册')}</Badge> : <Badge>{t('访客')}</Badge>}
                      <Segmented size="sm" value={m.status} onChange={(s) => setStatusOf(m, s)} options={[{ value: 'regular', label: t('正式') }, { value: 'trial', label: t('试工') }]} />
                      <button onClick={() => remove(m)} aria-label={t('删除 {name}', { name: m.name })} className="press rounded p-1.5 text-faint hover:bg-sunken hover:text-danger"><Trash size={16} /></button>
                    </div>

                    {/* 桌面：矩阵格子 */}
                    {positions.map((p) => {
                      const on = !!skills.get(m.id)?.has(p.id)
                      return (
                        <button key={p.id} role="checkbox" aria-checked={on} aria-label={`${m.name} ${p.name}`} onClick={() => toggle(m, p)}
                          className="press mx-auto hidden h-8 w-8 place-items-center rounded-full border md:grid"
                          style={on ? roleStyle(p.color) : { borderColor: 'var(--line-strong)', borderStyle: 'dashed' }}>
                          {on && <Check size={15} weight="bold" />}
                        </button>
                      )
                    })}

                    {/* 手机：岗位胶囊 */}
                    {positions.length > 0 && (
                      <div className="col-span-full flex flex-wrap gap-1.5 md:hidden">
                        {positions.map((p) => {
                          const on = !!skills.get(m.id)?.has(p.id)
                          return (
                            <button key={p.id} role="checkbox" aria-checked={on} onClick={() => toggle(m, p)}
                              className={cn('press flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold', !on && 'border-dashed border-line-strong text-mute')}
                              style={on ? roleStyle(p.color) : undefined}>
                              {on ? <Check size={13} weight="bold" /> : <span className="h-2 w-2 rounded-full" style={{ background: roleDot(p.color) }} />}{p.name}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            {/* 每个岗位有几个人会：少于 2 个人时提醒"没有备份" */}
            {positions.length > 0 && (
              <div className="hidden items-center border-t border-line bg-sunken px-4 py-2.5 md:grid" style={grid}>
                <span className="text-xs font-medium text-mute">{t('会的人数')}</span>
                {positions.map((p) => {
                  const n = count(p)
                  return <span key={p.id} className={cn('num text-center text-sm', n <= 1 ? 'font-bold text-warn' : 'font-medium text-ink-2')} title={n === 0 ? t('还没有人会这个岗位') : n === 1 ? t('只有 1 个人会，没有备份') : undefined}>{n}</span>
                })}
              </div>
            )}
          </div>
        </div>
      )}
      {positions.length === 0 && members.length > 0 && <p className="text-sm text-mute">{t('先在「设置」里添加岗位标签，才能勾选员工会什么岗位。')}</p>}
    </div>
  )
}
