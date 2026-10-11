// 演示模式：未配置 Supabase 时使用，全部数据保存在浏览器 localStorage。
// 行为与 supabaseApi 保持一致（包括访客按名字报班、员工认领、发布后才可见、多门店）。
import type { Api } from './api'
import type {
  AppUser, Availability, DailyTask, Location, Member, MemberPosition, Position, Role, Shift, Shop,
} from '../lib/types'
import { DEFAULT_HOURS, POSITION_COLORS } from '../lib/types'
import { addDays, todayISO, weekStart } from '../lib/time'

interface DemoUser { id: string; email: string; role: Role }
interface DB {
  users: DemoUser[]
  session: string | null
  shops: (Shop & { owner_id: string })[]
  locations: Location[]
  positions: Position[]
  members: Member[]
  availability: Availability[]
  shifts: Shift[]
  tasks: DailyTask[]
  publications: { shop_id: string; week_start: string }[]
  memberPositions: (MemberPosition & { shop_id: string })[]
}

const KEY = 'shift-scheduler-demo-v2'
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36))
const delay = () => new Promise((r) => setTimeout(r, 40))

export const DEMO_ACCOUNTS = {
  manager: { email: 'boss@demo.shift', password: 'demo1234' },
  staff: { email: 'lin@demo.shift', password: 'demo1234' },
}
export const DEMO_SHOP_CODE = 'zhaomu01'

function seed(): DB {
  const ws = weekStart(todayISO())
  const owner: DemoUser = { id: 'u-boss', email: DEMO_ACCOUNTS.manager.email, role: 'manager' }
  const lin: DemoUser = { id: 'u-lin', email: DEMO_ACCOUNTS.staff.email, role: 'staff' }
  const shop: DB['shops'][number] = {
    id: 's1', owner_id: owner.id, name: '朝暮茶事', code: DEMO_SHOP_CODE, code_enabled: true, week_start: 1, region: 'ON', pdf_style: 'table',
    hours: DEFAULT_HOURS.map((h, i) => (i >= 5 ? { open: 600, close: 1380 } : { ...h, close: 1260 })),
  }
  const locations: Location[] = [
    { id: 'l-main', shop_id: 's1', name: '中央店', sort: 0 },
    { id: 'l-north', shop_id: 's1', name: '北区店', sort: 1 },
  ]
  const pos: Position[] = [
    { id: 'p-prep', shop_id: 's1', name: 'prep', color: POSITION_COLORS[0], sort: 0 },
    { id: 'p-bar', shop_id: 's1', name: 'bar', color: POSITION_COLORS[1], sort: 1 },
    { id: 'p-cash', shop_id: 's1', name: 'cashier', color: POSITION_COLORS[4], sort: 2 },
  ]
  const names: [string, Member['status'], string | null][] = [
    ['林晓', 'regular', lin.id], ['周屿', 'regular', null], ['陈嘉禾', 'trial', null],
    ['吴桐', 'regular', null], ['许安然', 'trial', null], ['高见', 'regular', null],
  ]
  const members: Member[] = names.map(([name, status, user_id], i) => ({ id: `m${i + 1}`, shop_id: 's1', name, status, user_id }))
  const availability: Availability[] = []
  // 每人一套大致的可用时间模式（分钟）；周末营业时间更晚。吴桐只能去北区店。
  const pattern: Record<string, (d: number) => [number, number][]> = {
    m1: (d) => (d < 5 ? [[540, 1020]] : [[600, 1380]]),
    m2: (d) => (d % 2 === 0 ? [[720, 1260]] : []),
    m3: (d) => (d >= 4 ? [[600, 1080]] : [[900, 1260]]),
    m4: (d) => (d < 3 ? [[540, 840]] : [[540, 1260]]),
    m5: (d) => (d === 1 || d === 3 || d >= 5 ? [[600, 1380]] : []),
    m6: (d) => (d < 6 ? [[660, 1260]] : []),
  }
  for (const m of members) {
    if (m.id === 'm5') continue // 许安然还没报班，演示"未提交"状态
    for (let d = 0; d < 7; d++) {
      const h = shop.hours[d]
      if (!h) continue
      for (const [a, b] of pattern[m.id](d)) {
        availability.push({
          id: uid(), shop_id: 's1', member_id: m.id, day: addDays(ws, d), start_min: Math.max(a, h.open), end_min: Math.min(b, h.close),
          note: '', location_ids: m.id === 'm4' ? ['l-north'] : [],
        })
      }
    }
  }
  const shifts: Shift[] = [
    ['m1', 'p-cash', 0, 540, 900], ['m4', 'p-prep', 0, 540, 840, 'l-north'], ['m2', 'p-bar', 0, 720, 1260], ['m6', 'p-bar', 0, 660, 900],
    ['m1', 'p-cash', 1, 540, 900], ['m4', 'p-prep', 1, 540, 840, 'l-north'], ['m3', 'p-bar', 1, 900, 1260],
    ['m1', 'p-cash', 2, 540, 1020], ['m2', 'p-bar', 2, 720, 1260], ['m4', 'p-prep', 2, 540, 840, 'l-north'],
  ].map(([m, p, d, a, b, l]) => ({
    id: uid(), shop_id: 's1', member_id: m as string, position_id: p as string, location_id: (l as string | undefined) ?? 'l-main',
    day: addDays(ws, d as number), start_min: a as number, end_min: b as number, note: '',
    // 陈嘉禾只会 prep，被排进 bar：这是一个培训班次
    training: m === 'm3' && p === 'p-bar',
  }))
  const tasks: DailyTask[] = [
    { shop_id: 's1', location_id: 'l-main', day: addDays(ws, 0), text: 'Floor mat 地毯（用吸尘器）\nSyrup pump 糖浆泵头\nWindows 窗户' },
    { shop_id: 's1', location_id: 'l-main', day: addDays(ws, 2), text: 'Weekly Inventory 每周盘点' },
  ]
  return {
    users: [owner, lin], session: null, shops: [shop], locations, positions: pos, members, availability, shifts, tasks,
    publications: [{ shop_id: 's1', week_start: ws }],
    // 技能矩阵：林晓会 cashier 和 prep，周屿会 bar，陈嘉禾只会 prep，许安然还没设置
    memberPositions: ([['m1', 'p-cash'], ['m1', 'p-prep'], ['m2', 'p-bar'], ['m3', 'p-prep'], ['m4', 'p-prep'], ['m6', 'p-bar'], ['m6', 'p-cash']] as const)
      .map(([member_id, position_id]) => ({ member_id, position_id, shop_id: 's1' })),
  }
}

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const old = JSON.parse(raw) as DB
      // 旧版本的演示数据没有技能矩阵和培训标记
      old.memberPositions ??= []
      old.shifts.forEach((s) => { s.training ??= false })
      return old
    }
  } catch { /* ignore */ }
  const db = seed()
  save(db)
  return db
}
function save(db: DB) { try { localStorage.setItem(KEY, JSON.stringify(db)) } catch { /* ignore */ } }
export function resetDemo() { try { localStorage.removeItem(KEY) } catch { /* ignore */ } }

type ShopRow = Shop & { owner_id?: string }
const strip = (s: ShopRow): Shop => ({ id: s.id, name: s.name, code: s.code, code_enabled: s.code_enabled !== false, hours: s.hours, week_start: s.week_start, region: s.region, pdf_style: s.pdf_style })
const firstLocation = (db: DB, shopId: string) => db.locations.filter((l) => l.shop_id === shopId).sort((a, b) => a.sort - b.sort)[0]

export function createDemoApi(): Api {
  const db = load()
  const listeners = new Set<(u: AppUser | null) => void>()
  const commit = () => save(db)
  const me = (): DemoUser | null => db.users.find((u) => u.id === db.session) ?? null
  const asUser = (u: DemoUser | null): AppUser | null => (u ? { id: u.id, email: u.email, role: u.role } : null)
  const emit = () => listeners.forEach((cb) => cb(asUser(me())))
  const shopByCode = (code: string) => db.shops.find((s) => s.code === code)
  const weekOf = (shopId: string, day: string) => weekStart(day, db.shops.find((s) => s.id === shopId)?.week_start ?? 1)

  return {
    mode: 'demo',
    async getUser() { await delay(); return asUser(me()) },
    onAuth(cb) { listeners.add(cb); return () => { listeners.delete(cb) } },
    async signUp(email, _password, role) {
      await delay()
      if (db.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) throw new Error('User already registered')
      const u = { id: uid(), email, role }
      db.users.push(u); db.session = u.id; commit(); emit()
    },
    async signIn(email) {
      await delay()
      const u = db.users.find((x) => x.email.toLowerCase() === email.toLowerCase())
      if (!u) throw new Error('Invalid login credentials')
      db.session = u.id; commit(); emit()
    },
    async signOut() { db.session = null; commit(); emit() },
    async requestPasswordReset() { await delay() }, // 演示模式不发邮件
    async updatePassword() { await delay() }, // 演示模式不校验密码
    async deleteAccount() {
      await delay()
      const u = me(); if (!u) throw new Error('not_authenticated')
      // 与数据库函数 delete_my_account 一致：店长名下的店铺连同全部数据，员工自己的员工记录连同报班和班次
      const ownedShops = new Set(db.shops.filter((s) => s.owner_id === u.id).map((s) => s.id))
      const myMembers = new Set(db.members.filter((m) => m.user_id === u.id).map((m) => m.id))
      db.shops = db.shops.filter((s) => !ownedShops.has(s.id))
      for (const key of ['locations', 'positions', 'members', 'availability', 'shifts', 'tasks', 'publications'] as const) {
        ;(db as unknown as Record<string, { shop_id: string }[]>)[key] = (db[key] as { shop_id: string }[]).filter((r) => !ownedShops.has(r.shop_id))
      }
      db.members = db.members.filter((m) => !myMembers.has(m.id))
      db.availability = db.availability.filter((a) => !myMembers.has(a.member_id))
      db.shifts = db.shifts.filter((s) => !myMembers.has(s.member_id))
      db.users = db.users.filter((x) => x.id !== u.id)
      db.session = null; commit(); emit()
    },

    async getOwnedShop() {
      await delay()
      const u = me(); const s = u && db.shops.find((x) => x.owner_id === u.id)
      return s ? strip(s) : null
    },
    async createShop(name, positionNames) {
      await delay()
      const u = me()!
      const s: DB['shops'][number] = { id: uid(), owner_id: u.id, name, code: uid().replace(/-/g, '').slice(0, 8), code_enabled: true, hours: DEFAULT_HOURS.map((h) => ({ ...h })), week_start: 1, region: 'CA', pdf_style: 'table' }
      db.shops.push(s)
      db.locations.push({ id: uid(), shop_id: s.id, name, sort: 0 })
      positionNames.forEach((n, i) => db.positions.push({ id: uid(), shop_id: s.id, name: n, color: POSITION_COLORS[i % POSITION_COLORS.length], sort: i }))
      commit(); return strip(s)
    },
    async updateShop(id, patch) {
      const s = db.shops.find((x) => x.id === id)!
      // 与数据库触发器一致：修改一周起始日会清空发布记录
      if (patch.week_start !== undefined && patch.week_start !== s.week_start) db.publications = db.publications.filter((p) => p.shop_id !== id)
      Object.assign(s, patch); commit()
    },

    async listLocations(shopId) { await delay(); return db.locations.filter((l) => l.shop_id === shopId).sort((a, b) => a.sort - b.sort) },
    async createLocation(shopId, name) {
      const l: Location = { id: uid(), shop_id: shopId, name, sort: db.locations.filter((x) => x.shop_id === shopId).length }
      db.locations.push(l); commit(); return l
    },
    async updateLocation(id, patch) { Object.assign(db.locations.find((l) => l.id === id)!, patch); commit() },
    async deleteLocation(id) {
      db.locations = db.locations.filter((l) => l.id !== id)
      db.shifts = db.shifts.filter((s) => s.location_id !== id)
      db.tasks = db.tasks.filter((t) => t.location_id !== id)
      db.availability.forEach((a) => { a.location_ids = a.location_ids.filter((x) => x !== id) })
      commit()
    },

    async listPositions(shopId) { await delay(); return db.positions.filter((p) => p.shop_id === shopId).sort((a, b) => a.sort - b.sort) },
    async createPosition(shopId, name, color) {
      const p: Position = { id: uid(), shop_id: shopId, name, color, sort: db.positions.filter((x) => x.shop_id === shopId).length }
      db.positions.push(p); commit(); return p
    },
    async updatePosition(id, patch) { Object.assign(db.positions.find((p) => p.id === id)!, patch); commit() },
    async deletePosition(id) {
      db.positions = db.positions.filter((p) => p.id !== id)
      db.memberPositions = db.memberPositions.filter((x) => x.position_id !== id)
      db.shifts.forEach((s) => { if (s.position_id === id) s.position_id = null })
      commit()
    },

    async listMembers(shopId) { await delay(); return db.members.filter((m) => m.shop_id === shopId) },
    async createMember(shopId, name, status) {
      if (db.members.some((m) => m.shop_id === shopId && m.name.toLowerCase() === name.toLowerCase())) throw new Error('这个名字已经存在')
      const m: Member = { id: uid(), shop_id: shopId, name, status, user_id: null }
      db.members.push(m); commit(); return m
    },
    async updateMember(id, patch) { Object.assign(db.members.find((m) => m.id === id)!, patch); commit() },
    async deleteMember(id) {
      db.members = db.members.filter((m) => m.id !== id)
      db.memberPositions = db.memberPositions.filter((x) => x.member_id !== id)
      db.availability = db.availability.filter((a) => a.member_id !== id)
      db.shifts = db.shifts.filter((s) => s.member_id !== id)
      commit()
    },

    async listMemberPositions(shopId) {
      await delay()
      const u = me()
      const owns = u && db.shops.some((s) => s.id === shopId && s.owner_id === u.id)
      const mine = new Set(db.members.filter((m) => u && m.user_id === u.id).map((m) => m.id))
      return db.memberPositions.filter((x) => x.shop_id === shopId && (owns || mine.has(x.member_id))).map(({ member_id, position_id }) => ({ member_id, position_id }))
    },
    async setMemberPosition(shopId, memberId, positionId, on) {
      const m = db.members.find((x) => x.id === memberId)
      const p = db.positions.find((x) => x.id === positionId)
      if (!m || !p || m.shop_id !== shopId || p.shop_id !== shopId) throw new Error('shop_not_found')
      db.memberPositions = db.memberPositions.filter((x) => !(x.member_id === memberId && x.position_id === positionId))
      if (on) db.memberPositions.push({ member_id: memberId, position_id: positionId, shop_id: shopId })
      commit()
    },

    async listAvailability(shopId, from, to) { await delay(); return db.availability.filter((a) => a.shop_id === shopId && a.day >= from && a.day <= to) },
    async listShifts(shopId, from, to) { await delay(); return db.shifts.filter((s) => s.shop_id === shopId && s.day >= from && s.day <= to) },
    async createShift(shopId, input) {
      const s: Shift = { id: uid(), shop_id: shopId, note: '', training: false, ...input, location_id: input.location_id ?? firstLocation(db, shopId).id }
      db.shifts.push(s); commit(); return s
    },
    async updateShift(id, patch) { Object.assign(db.shifts.find((s) => s.id === id)!, patch); commit() },
    async deleteShift(id) { db.shifts = db.shifts.filter((s) => s.id !== id); commit() },

    async listDailyTasks(shopId, from, to) {
      await delay()
      const u = me(); const isOwner = !!u && db.shops.some((s) => s.id === shopId && s.owner_id === u.id)
      const published = new Set(db.publications.filter((p) => p.shop_id === shopId).map((p) => p.week_start))
      return db.tasks.filter((t) => t.shop_id === shopId && t.day >= from && t.day <= to && (isOwner || published.has(weekOf(shopId, t.day))))
    },
    async setDailyTask(shopId, locationId, day, text) {
      db.tasks = db.tasks.filter((t) => !(t.location_id === locationId && t.day === day))
      if (text.trim()) db.tasks.push({ shop_id: shopId, location_id: locationId, day, text })
      commit()
    },
    async listPublished(shopId) { return db.publications.filter((p) => p.shop_id === shopId).map((p) => p.week_start) },
    async setPublished(shopId, ws, on) {
      db.publications = db.publications.filter((p) => !(p.shop_id === shopId && p.week_start === ws))
      if (on) db.publications.push({ shop_id: shopId, week_start: ws })
      commit()
    },

    async getPublicShop(code) {
      await delay()
      const s = shopByCode(code)
      if (!s) return null
      return {
        name: s.name, hours: s.hours, week_start: s.week_start, region: s.region, claim_enabled: s.code_enabled !== false,
        locations: db.locations.filter((l) => l.shop_id === s.id).sort((a, b) => a.sort - b.sort).map((l) => ({ id: l.id, name: l.name })),
        members: db.members.filter((m) => m.shop_id === s.id).map((m) => ({ name: m.name, claimed: !!m.user_id })),
      }
    },
    async getGuestAvailability(code, name, ws) {
      const s = shopByCode(code)
      const m = s && db.members.find((x) => x.shop_id === s.id && x.name.toLowerCase() === name.trim().toLowerCase())
      if (!m || m.user_id) return []
      return db.availability.filter((a) => a.member_id === m.id && a.day >= ws && a.day < addDays(ws, 7)).map((a) => ({ day: a.day, start: a.start_min, end: a.end_min, note: a.note, locations: a.location_ids }))
    },
    async submitAvailability(code, name, ws, entries) {
      await delay()
      const s = shopByCode(code)
      if (!s) throw new Error('shop_not_found')
      const u = me()
      let m = u ? db.members.find((x) => x.shop_id === s.id && x.user_id === u.id) : undefined
      if (!m) {
        const nm = name.trim()
        if (!nm) throw new Error('name_required')
        m = db.members.find((x) => x.shop_id === s.id && x.name.toLowerCase() === nm.toLowerCase())
        if (m && m.user_id && (!u || m.user_id !== u.id)) throw new Error('name_claimed')
        if (!m) { m = { id: uid(), shop_id: s.id, name: nm.slice(0, 30), status: 'regular', user_id: null }; db.members.push(m) }
      }
      const end = addDays(ws, 7)
      const validLocs = new Set(db.locations.filter((l) => l.shop_id === s.id).map((l) => l.id))
      db.availability = db.availability.filter((a) => !(a.member_id === m!.id && a.day >= ws && a.day < end))
      for (const e of entries) {
        if (e.day >= ws && e.day < end && e.end > e.start) {
          db.availability.push({ id: uid(), shop_id: s.id, member_id: m.id, day: e.day, start_min: e.start, end_min: e.end, note: e.note, location_ids: (e.locations ?? []).filter((x) => validLocs.has(x)) })
        }
      }
      commit()
    },
    async claimMember(code, name) {
      await delay()
      const u = me(); if (!u) throw new Error('not_authenticated')
      const s = shopByCode(code); if (!s) throw new Error('shop_not_found')
      if (db.members.some((m) => m.shop_id === s.id && m.user_id === u.id)) return
      // 与数据库一致：已经绑定的不受影响，新的绑定要店长开着店铺码
      if (s.code_enabled === false) throw new Error('claim_disabled')
      const nm = name.trim(); if (!nm) throw new Error('name_required')
      const m = db.members.find((x) => x.shop_id === s.id && x.name.toLowerCase() === nm.toLowerCase())
      if (m) {
        if (m.user_id) throw new Error('name_claimed')
        m.user_id = u.id
      } else db.members.push({ id: uid(), shop_id: s.id, name: nm, status: 'regular', user_id: u.id })
      commit()
    },
    async getMembership() {
      await delay()
      const u = me(); const m = u && db.members.find((x) => x.user_id === u.id)
      if (!m) return null
      return { shop: strip(db.shops.find((s) => s.id === m.shop_id)!), member: m }
    },
    async listMyAvailability(memberId, from, to) {
      return db.availability.filter((a) => a.member_id === memberId && a.day >= from && a.day <= to).map((a) => ({ day: a.day, start: a.start_min, end: a.end_min, note: a.note, locations: a.location_ids }))
    },
    async listMyShifts(memberId, from, to) {
      await delay()
      const m = db.members.find((x) => x.id === memberId)
      const pub = new Set(db.publications.filter((p) => p.shop_id === m?.shop_id).map((p) => p.week_start))
      return db.shifts
        .filter((s) => s.member_id === memberId && s.day >= from && s.day <= to && pub.has(weekOf(s.shop_id, s.day)))
        .sort((a, b) => (a.day + String(a.start_min).padStart(4, '0')).localeCompare(b.day + String(b.start_min).padStart(4, '0')))
    },
  }
}
