// @vitest-environment jsdom
// 演示数据层模拟真实后端的规则（访客报班、员工认领、发布后才可见、注销账号等）。
// 这里用固定的"今天"，种子数据里的日期因此是确定的：今天 2026-10-07（周三），本周周一 2026-10-05。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDemoApi } from './demoApi'
import type { Api } from './api'
import { addDays } from '../lib/time'

const CODE = 'zhaomu01' // 演示店铺码
const SHOP = 's1'
const WS = '2026-10-05' // 本周周一，种子班表所在的那一周，已发布
const BOSS = 'boss@demo.shift'
const LIN = 'lin@demo.shift' // 员工「林晓」，已绑定成员 m1

let api: Api
const entry = (day: string, start = 540, end = 900, locations: string[] = [], note = '') => ({ day, start, end, note, locations })
const as = (email: string) => api.signIn(email, 'x')
const rejects = (p: Promise<unknown>, message: string) => expect(p).rejects.toThrow(message)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }) // 只固定日期，不影响 setTimeout
  vi.setSystemTime(new Date(2026, 9, 7, 12))
  localStorage.clear()
  api = createDemoApi()
})
afterEach(() => vi.useRealTimers())

describe('guest availability (no account)', () => {
  it('creates the person on first submit and stores their week', async () => {
    await api.submitAvailability(CODE, '沈知微', WS, [entry(WS, 540, 900, ['l-north'], 'class')])
    const members = await api.listMembers(SHOP)
    const m = members.find((x) => x.name === '沈知微')!
    expect(m).toMatchObject({ status: 'regular', user_id: null })
    expect(await api.getGuestAvailability(CODE, '沈知微', WS)).toEqual([{ day: WS, start: 540, end: 900, note: 'class', locations: ['l-north'] }])
  })

  it('replaces the whole week on re-submit but keeps other weeks', async () => {
    const next = addDays(WS, 7)
    await api.submitAvailability(CODE, '沈知微', next, [entry(next)])
    await api.submitAvailability(CODE, '沈知微', WS, [entry(WS), entry(addDays(WS, 1))])
    await api.submitAvailability(CODE, '沈知微', WS, [entry(addDays(WS, 2))])
    expect((await api.getGuestAvailability(CODE, '沈知微', WS)).map((e) => e.day)).toEqual([addDays(WS, 2)])
    expect(await api.getGuestAvailability(CODE, '沈知微', next)).toHaveLength(1)
  })

  it('ignores entries outside the submitted week and entries that end before they start', async () => {
    await api.submitAvailability(CODE, '沈知微', WS, [
      entry(addDays(WS, 7)), // 下一周
      entry(addDays(WS, -1)), // 上一周
      entry(addDays(WS, 1), 900, 900), // 长度为 0
      entry(addDays(WS, 2), 900, 600), // 结束早于开始
      entry(addDays(WS, 3)), // 唯一有效的
    ])
    expect((await api.getGuestAvailability(CODE, '沈知微', WS)).map((e) => e.day)).toEqual([addDays(WS, 3)])
  })

  it('drops location ids that do not belong to the shop', async () => {
    await api.submitAvailability(CODE, '沈知微', WS, [entry(WS, 540, 900, ['l-north', 'not-a-location'])])
    expect((await api.getGuestAvailability(CODE, '沈知微', WS))[0].locations).toEqual(['l-north'])
  })

  it('matches names case-insensitively and does not create duplicates', async () => {
    await api.submitAvailability(CODE, 'Sam', WS, [entry(WS)])
    const before = (await api.listMembers(SHOP)).length
    await api.submitAvailability(CODE, 'sam', WS, [entry(addDays(WS, 1))])
    expect((await api.listMembers(SHOP)).length).toBe(before)
    expect(await api.getGuestAvailability(CODE, 'SAM', WS)).toHaveLength(1)
  })

  it('requires a name and a real shop', async () => {
    await rejects(api.submitAvailability(CODE, '   ', WS, [entry(WS)]), 'name_required')
    await rejects(api.submitAvailability('nope', '沈知微', WS, [entry(WS)]), 'shop_not_found')
  })

  it('cannot overwrite or read a registered staff member’s availability by typing their name', async () => {
    await rejects(api.submitAvailability(CODE, '林晓', WS, [entry(WS)]), 'name_claimed')
    expect(await api.getGuestAvailability(CODE, '林晓', WS)).toEqual([])
  })

  it('can still use names that nobody has registered', async () => {
    await expect(api.submitAvailability(CODE, '周屿', WS, [entry(WS)])).resolves.toBeUndefined()
  })

  it('exposes the shop publicly with member names and whether each is registered', async () => {
    const shop = (await api.getPublicShop(CODE))!
    expect(shop.name).toBe('朝暮茶事')
    expect(shop.locations.map((l) => l.id)).toEqual(['l-main', 'l-north'])
    expect(shop.members.find((m) => m.name === '林晓')?.claimed).toBe(true)
    expect(shop.members.find((m) => m.name === '周屿')?.claimed).toBe(false)
    expect(await api.getPublicShop('nope')).toBeNull()
  })

  it('persists across a page reload (new api instance on the same storage)', async () => {
    await api.submitAvailability(CODE, '沈知微', WS, [entry(WS)])
    const reloaded = createDemoApi()
    expect(await reloaded.getGuestAvailability(CODE, '沈知微', WS)).toHaveLength(1)
  })
})

describe('registered staff', () => {
  it('a signed-in staff member always submits as themselves, whatever name is passed', async () => {
    await as(LIN)
    await api.submitAvailability(CODE, '', WS, [entry(WS, 600, 700)])
    await api.submitAvailability(CODE, '别人的名字', WS, [entry(WS, 600, 700)])
    expect((await api.listMembers(SHOP)).some((m) => m.name === '别人的名字')).toBe(false)
    expect(await api.listMyAvailability('m1', WS, addDays(WS, 6))).toHaveLength(1)
  })

  it('claiming an existing guest name links the account and keeps their earlier availability', async () => {
    await api.signUp('new@example.com', 'secret1', 'staff')
    await api.claimMember(CODE, '周屿')
    const ms = (await api.getMembership())!
    expect(ms.member.id).toBe('m2')
    expect(ms.member.user_id).not.toBeNull()
    expect((await api.listMyAvailability('m2', WS, addDays(WS, 6))).length).toBeGreaterThan(0) // 种子里周屿已有报班
  })

  it('claiming a new name creates a new member', async () => {
    await api.signUp('new@example.com', 'secret1', 'staff')
    await api.claimMember(CODE, '全新员工')
    const ms = (await api.getMembership())!
    expect(ms.member.name).toBe('全新员工')
    expect((await api.listMembers(SHOP)).filter((m) => m.name === '全新员工')).toHaveLength(1)
  })

  it('claiming is idempotent for an account that is already linked', async () => {
    await api.signUp('new@example.com', 'secret1', 'staff')
    await api.claimMember(CODE, '周屿')
    await api.claimMember(CODE, '吴桐') // 已绑定，换名字也不会再绑第二个
    expect((await api.getMembership())!.member.id).toBe('m2')
  })

  it('a name that already belongs to an account cannot be claimed by someone else', async () => {
    await api.signUp('first@example.com', 'secret1', 'staff')
    await api.claimMember(CODE, '周屿')
    await api.signOut()
    await api.signUp('second@example.com', 'secret1', 'staff')
    await rejects(api.claimMember(CODE, '周屿'), 'name_claimed')
    await rejects(api.claimMember(CODE, '林晓'), 'name_claimed')
  })

  it('claiming requires being signed in and a real shop', async () => {
    await rejects(api.claimMember(CODE, '周屿'), 'not_authenticated')
    await api.signUp('new@example.com', 'secret1', 'staff')
    await rejects(api.claimMember('nope', '周屿'), 'shop_not_found')
    await rejects(api.claimMember(CODE, '  '), 'name_required')
  })

  it('after claiming, strangers can no longer write under that name', async () => {
    await api.signUp('new@example.com', 'secret1', 'staff')
    await api.claimMember(CODE, '周屿')
    await api.signOut()
    await rejects(api.submitAvailability(CODE, '周屿', WS, [entry(WS)]), 'name_claimed')
  })
})

describe('accounts', () => {
  it('rejects a duplicate sign-up and unknown sign-in', async () => {
    await rejects(api.signUp(LIN, 'secret1', 'staff'), 'User already registered')
    await rejects(api.signUp('LIN@demo.shift', 'secret1', 'staff'), 'User already registered') // 邮箱不区分大小写
    await rejects(api.signIn('nobody@example.com', 'x'), 'Invalid login credentials')
  })

  it('reports the signed-in user and notifies listeners', async () => {
    const seen: (string | null)[] = []
    api.onAuth((u) => seen.push(u?.email ?? null))
    expect(await api.getUser()).toBeNull()
    await as(BOSS)
    expect((await api.getUser())?.role).toBe('manager')
    await api.signOut()
    expect(seen).toEqual([BOSS, null])
  })
})

describe('publishing controls what staff can see', () => {
  const lin = () => api.listMyShifts('m1', WS, addDays(WS, 6))

  it('staff see their shifts in a published week', async () => {
    expect(await lin()).toHaveLength(3)
  })

  it('staff see nothing once the week is unpublished, and again after republishing', async () => {
    await as(BOSS)
    await api.setPublished(SHOP, WS, false)
    expect(await lin()).toEqual([])
    await api.setPublished(SHOP, WS, true)
    expect(await lin()).toHaveLength(3)
  })

  it('shifts in a week that was never published stay hidden', async () => {
    await as(BOSS)
    const next = addDays(WS, 7)
    await api.createShift(SHOP, { member_id: 'm1', position_id: null, location_id: 'l-main', day: next, start_min: 540, end_min: 900 })
    expect(await api.listMyShifts('m1', next, addDays(next, 6))).toEqual([])
    expect((await api.listShifts(SHOP, next, addDays(next, 6)))).toHaveLength(1) // 店长自己看得到
  })

  it('daily tasks follow the same rule; the owner always sees them', async () => {
    await as(LIN)
    expect((await api.listDailyTasks(SHOP, WS, addDays(WS, 6))).length).toBe(2)
    await as(BOSS)
    await api.setPublished(SHOP, WS, false)
    expect((await api.listDailyTasks(SHOP, WS, addDays(WS, 6))).length).toBe(2)
    await as(LIN)
    expect(await api.listDailyTasks(SHOP, WS, addDays(WS, 6))).toEqual([])
  })

  it('an empty daily task deletes it', async () => {
    await as(BOSS)
    await api.setDailyTask(SHOP, 'l-main', WS, '')
    expect((await api.listDailyTasks(SHOP, WS, WS)).filter((t) => t.location_id === 'l-main')).toEqual([])
    await api.setDailyTask(SHOP, 'l-main', WS, 'Clean the windows')
    expect((await api.listDailyTasks(SHOP, WS, WS))[0].text).toBe('Clean the windows')
  })

  it('shifts only belong to the published week according to the shop’s first day of the week', async () => {
    await as(BOSS)
    const sunday = addDays(WS, 6) // 2026-10-11，周日
    await api.createShift(SHOP, { member_id: 'm1', position_id: null, location_id: 'l-main', day: sunday, start_min: 540, end_min: 900 })
    // 周一开始：周日属于 10-05 那一周，该周已发布，所以看得见
    expect(await api.listMyShifts('m1', WS, sunday)).toHaveLength(4)

    // 改成周日开始：发布记录被清空；周日 10-11 属于新的一周（10-11 起），而发布的是 10-04 那一周
    await api.updateShop(SHOP, { week_start: 0 })
    expect(await api.listPublished(SHOP)).toEqual([])
    await api.setPublished(SHOP, '2026-10-04', true)
    const visible = await api.listMyShifts('m1', '2026-10-04', addDays(sunday, 6))
    expect(visible).toHaveLength(3) // 周一到周三的班次可见
    expect(visible.some((s) => s.day === sunday)).toBe(false)
  })

  it('changing other shop settings does not unpublish anything', async () => {
    await as(BOSS)
    await api.updateShop(SHOP, { region: 'BC', pdf_style: 'timeline', name: '新店名' })
    expect(await api.listPublished(SHOP)).toEqual([WS])
  })
})

describe('managing shop data', () => {
  beforeEach(() => as(BOSS))

  it('rejects duplicate staff names, ignoring case', async () => {
    await api.createMember(SHOP, 'Sam', 'regular')
    await rejects(api.createMember(SHOP, 'sam', 'trial'), '这个名字已经存在')
  })

  it('deleting a location removes its shifts and tasks and strips it from availability', async () => {
    await api.deleteLocation('l-north')
    const shifts = await api.listShifts(SHOP, WS, addDays(WS, 6))
    expect(shifts.every((s) => s.location_id !== 'l-north')).toBe(true)
    expect(shifts.length).toBeGreaterThan(0) // 中央店的班次还在
    const avail = await api.listAvailability(SHOP, WS, addDays(WS, 6))
    expect(avail.every((a) => !a.location_ids.includes('l-north'))).toBe(true)
  })

  it('deleting a position keeps the shifts but clears their position', async () => {
    const before = await api.listShifts(SHOP, WS, addDays(WS, 6))
    await api.deletePosition('p-bar')
    const after = await api.listShifts(SHOP, WS, addDays(WS, 6))
    expect(after).toHaveLength(before.length)
    expect(after.filter((s) => s.position_id === 'p-bar')).toEqual([])
    expect(after.filter((s) => before.find((b) => b.id === s.id)!.position_id === 'p-bar').every((s) => s.position_id === null)).toBe(true)
  })

  it('deleting a staff member removes their availability and shifts too', async () => {
    await api.deleteMember('m2')
    expect((await api.listMembers(SHOP)).some((m) => m.id === 'm2')).toBe(false)
    expect((await api.listShifts(SHOP, WS, addDays(WS, 6))).some((s) => s.member_id === 'm2')).toBe(false)
    expect((await api.listAvailability(SHOP, WS, addDays(WS, 6))).some((a) => a.member_id === 'm2')).toBe(false)
  })

  it('creates, updates and deletes shifts', async () => {
    const s = await api.createShift(SHOP, { member_id: 'm6', position_id: 'p-prep', location_id: 'l-main', day: addDays(WS, 3), start_min: 1110, end_min: 1500 })
    expect(s).toMatchObject({ start_min: 1110, end_min: 1500, note: '' }) // 跨午夜的班次
    await api.updateShift(s.id, { end_min: 1470, note: 'close' })
    expect((await api.listShifts(SHOP, addDays(WS, 3), addDays(WS, 3))).find((x) => x.id === s.id)).toMatchObject({ end_min: 1470, note: 'close' })
    await api.deleteShift(s.id)
    expect((await api.listShifts(SHOP, addDays(WS, 3), addDays(WS, 3))).some((x) => x.id === s.id)).toBe(false)
  })
})

describe('account deletion', () => {
  it('a manager deleting the account removes the shop and everything under it', async () => {
    await as(BOSS)
    await api.deleteAccount()
    expect(await api.getUser()).toBeNull()
    expect(await api.getPublicShop(CODE)).toBeNull()
    expect(await api.listMembers(SHOP)).toEqual([])
    expect(await api.listShifts(SHOP, WS, addDays(WS, 6))).toEqual([])
    expect(await api.listLocations(SHOP)).toEqual([])
    await rejects(api.signIn(BOSS, 'x'), 'Invalid login credentials')
  })

  it('a manager’s deletion does not delete the staff accounts, they just lose the shop', async () => {
    await as(BOSS)
    await api.deleteAccount()
    await as(LIN) // 员工账号还在
    expect(await api.getMembership()).toBeNull()
  })

  it('a staff member deleting the account removes only their own records', async () => {
    const othersBefore = (await api.listShifts(SHOP, WS, addDays(WS, 6))).filter((s) => s.member_id !== 'm1').length
    await as(LIN)
    await api.deleteAccount()
    expect(await api.getUser()).toBeNull()
    await rejects(api.signIn(LIN, 'x'), 'Invalid login credentials')

    const members = await api.listMembers(SHOP)
    expect(members.some((m) => m.id === 'm1')).toBe(false)
    expect(members).toHaveLength(5)
    const shifts = await api.listShifts(SHOP, WS, addDays(WS, 6))
    expect(shifts.some((s) => s.member_id === 'm1')).toBe(false)
    expect(shifts).toHaveLength(othersBefore)
    expect((await api.listAvailability(SHOP, WS, addDays(WS, 6))).some((a) => a.member_id === 'm1')).toBe(false)
    expect(await api.getPublicShop(CODE)).not.toBeNull() // 店铺还在
  })

  it('after deleting, the name is free again for a guest', async () => {
    await as(LIN)
    await api.deleteAccount()
    await expect(api.submitAvailability(CODE, '林晓', WS, [entry(WS)])).resolves.toBeUndefined()
    expect((await api.listMembers(SHOP)).find((m) => m.name === '林晓')?.user_id).toBeNull()
  })

  it('needs a signed-in user', async () => {
    await rejects(api.deleteAccount(), 'not_authenticated')
  })

  it('password reset and update are accepted in demo mode', async () => {
    await expect(api.requestPasswordReset('anyone@example.com')).resolves.toBeUndefined()
    await expect(api.updatePassword('newpass1')).resolves.toBeUndefined()
  })
})
