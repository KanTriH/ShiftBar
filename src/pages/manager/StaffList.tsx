import { useState } from 'react'
import { Trash, UserPlus } from '@phosphor-icons/react'
import { Badge, Button, Empty, Input, Segmented, useToast } from '../../components/ui'
import { useManager } from './ManagerLayout'
import { api } from '../../data'
import { errMsg } from '../../lib/errors'
import type { Member, MemberStatus } from '../../lib/types'

export default function StaffList() {
  const { shop, members, reloadMembers } = useManager()
  const toast = useToast()
  const [name, setName] = useState('')
  const [status, setStatus] = useState<MemberStatus>('regular')

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    const n = name.trim(); if (!n) return
    try { await api.createMember(shop.id, n, status); setName(''); await reloadMembers() } catch (err) { toast(errMsg(err).includes('duplicate') ? '这个名字已经存在' : errMsg(err)) }
  }
  const setStatusOf = async (m: Member, s: MemberStatus) => { try { await api.updateMember(m.id, { status: s }); await reloadMembers() } catch (e) { toast(errMsg(e)) } }
  const rename = async (m: Member, v: string) => {
    const n = v.trim(); if (!n || n === m.name) return
    try { await api.updateMember(m.id, { name: n }); await reloadMembers() } catch (e) { toast(errMsg(e).includes('duplicate') ? '这个名字已经存在' : errMsg(e)); await reloadMembers() }
  }
  const remove = async (m: Member) => {
    if (!window.confirm(`删除「${m.name}」？TA 的报班和已排班次都会一起删除，无法恢复。`)) return
    try { await api.deleteMember(m.id); await reloadMembers(); toast('已删除') } catch (e) { toast(errMsg(e)) }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">员工</h1>
        <p className="mt-1 text-sm text-mute">试工员工在排班表里会带「试工」标记。员工通过报班链接填写时，名字会自动加到这里。</p>
      </div>

      <form onSubmit={add} className="flex flex-wrap items-center gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="员工名字" maxLength={30} className="min-w-[10rem] flex-1" aria-label="员工名字" />
        <Segmented value={status} onChange={setStatus} options={[{ value: 'regular', label: '正式' }, { value: 'trial', label: '试工' }]} />
        <Button type="submit" variant="primary" disabled={!name.trim()}><UserPlus size={16} />添加</Button>
      </form>

      {members.length === 0 ? <Empty title="还没有员工" hint="在上面输入名字添加，或把报班链接发给员工。" /> : (
        <ul className="divide-y divide-line rounded-panel border border-line bg-surface">
          {members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <input defaultValue={m.name} onBlur={(e) => rename(m, e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                aria-label={`${m.name} 的名字`} maxLength={30}
                className="h-8 min-w-0 flex-1 rounded-control bg-transparent px-2 text-sm font-medium hover:bg-sunken focus:bg-sunken focus:outline-none" />
              {m.user_id ? <Badge tone="accent">已注册</Badge> : <Badge>访客</Badge>}
              <Segmented size="sm" value={m.status} onChange={(s) => setStatusOf(m, s)} options={[{ value: 'regular', label: '正式' }, { value: 'trial', label: '试工' }]} />
              <button onClick={() => remove(m)} aria-label={`删除 ${m.name}`} className="press rounded p-1.5 text-faint hover:bg-sunken hover:text-danger"><Trash size={16} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
