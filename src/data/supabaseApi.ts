import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Api } from './api'
import type { AppUser, AvailEntry, Availability, DailyTask, Location, Member, Position, Shift, Shop } from '../lib/types'
import { POSITION_COLORS } from '../lib/types'

const sb = supabase!

function unwrap<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message)
  return r.data as T
}
const mapUser = (s: Session | null): AppUser | null =>
  s?.user ? { id: s.user.id, email: s.user.email ?? '', role: (s.user.user_metadata?.role as AppUser['role']) ?? null } : null

export function createSupabaseApi(): Api {
  return {
    mode: 'supabase',
    async getUser() { return mapUser((await sb.auth.getSession()).data.session) },
    onAuth(cb) {
      const { data } = sb.auth.onAuthStateChange((_e, s) => cb(mapUser(s)))
      return () => data.subscription.unsubscribe()
    },
    async signUp(email, password, role) {
      const { data, error } = await sb.auth.signUp({ email, password, options: { data: { role } } })
      if (error) throw new Error(error.message)
      if (!data.session) throw new Error('CONFIRM_EMAIL')
    },
    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password })
      if (error) throw new Error(error.message)
    },
    async signOut() { await sb.auth.signOut() },

    async getOwnedShop() {
      const u = (await sb.auth.getSession()).data.session?.user
      if (!u) return null
      return unwrap(await sb.from('shops').select('*').eq('owner_id', u.id).limit(1).maybeSingle()) as Shop | null
    },
    async createShop(name, positionNames) {
      const u = (await sb.auth.getSession()).data.session!.user
      const shop = unwrap(await sb.from('shops').insert({ name, owner_id: u.id }).select().single()) as Shop
      if (positionNames.length) {
        unwrap(await sb.from('positions').insert(
          positionNames.map((n, i) => ({ shop_id: shop.id, name: n, color: POSITION_COLORS[i % POSITION_COLORS.length], sort: i })),
        ))
      }
      return shop
    },
    async updateShop(id, patch) { unwrap(await sb.from('shops').update(patch).eq('id', id)) },

    async listLocations(shopId) {
      return unwrap(await sb.from('locations').select('*').eq('shop_id', shopId).order('sort').order('name')) as Location[]
    },
    async createLocation(shopId, name) {
      const { count } = await sb.from('locations').select('*', { count: 'exact', head: true }).eq('shop_id', shopId)
      return unwrap(await sb.from('locations').insert({ shop_id: shopId, name, sort: count ?? 0 }).select().single()) as Location
    },
    async updateLocation(id, patch) { unwrap(await sb.from('locations').update(patch).eq('id', id)) },
    async deleteLocation(id) { unwrap(await sb.from('locations').delete().eq('id', id)) },

    async listPositions(shopId) {
      return unwrap(await sb.from('positions').select('*').eq('shop_id', shopId).order('sort').order('name')) as Position[]
    },
    async createPosition(shopId, name, color) {
      const { count } = await sb.from('positions').select('*', { count: 'exact', head: true }).eq('shop_id', shopId)
      return unwrap(await sb.from('positions').insert({ shop_id: shopId, name, color, sort: count ?? 0 }).select().single()) as Position
    },
    async updatePosition(id, patch) { unwrap(await sb.from('positions').update(patch).eq('id', id)) },
    async deletePosition(id) { unwrap(await sb.from('positions').delete().eq('id', id)) },

    async listMembers(shopId) {
      return unwrap(await sb.from('members').select('*').eq('shop_id', shopId).order('created_at')) as Member[]
    },
    async createMember(shopId, name, status) {
      return unwrap(await sb.from('members').insert({ shop_id: shopId, name, status }).select().single()) as Member
    },
    async updateMember(id, patch) { unwrap(await sb.from('members').update(patch).eq('id', id)) },
    async deleteMember(id) { unwrap(await sb.from('members').delete().eq('id', id)) },

    async listAvailability(shopId, from, to) {
      return unwrap(await sb.from('availability').select('*').eq('shop_id', shopId).gte('day', from).lte('day', to)) as Availability[]
    },
    async listShifts(shopId, from, to) {
      return unwrap(await sb.from('shifts').select('*').eq('shop_id', shopId).gte('day', from).lte('day', to)) as Shift[]
    },
    async createShift(shopId, input) {
      return unwrap(await sb.from('shifts').insert({ ...input, shop_id: shopId, note: input.note ?? '' }).select().single()) as Shift
    },
    async updateShift(id, patch) { unwrap(await sb.from('shifts').update(patch).eq('id', id)) },
    async deleteShift(id) { unwrap(await sb.from('shifts').delete().eq('id', id)) },
    async listDailyTasks(shopId, from, to) {
      return unwrap(await sb.from('daily_tasks').select('*').eq('shop_id', shopId).gte('day', from).lte('day', to)) as DailyTask[]
    },
    async setDailyTask(shopId, locationId, day, text) {
      if (!text.trim()) unwrap(await sb.from('daily_tasks').delete().eq('location_id', locationId).eq('day', day))
      else unwrap(await sb.from('daily_tasks').upsert({ shop_id: shopId, location_id: locationId, day, text }, { onConflict: 'location_id,day' }))
    },
    async listPublished(shopId) {
      return (unwrap(await sb.from('publications').select('week_start').eq('shop_id', shopId)) as { week_start: string }[]).map((r) => r.week_start)
    },
    async setPublished(shopId, weekStart, on) {
      if (on) unwrap(await sb.from('publications').upsert({ shop_id: shopId, week_start: weekStart }))
      else unwrap(await sb.from('publications').delete().eq('shop_id', shopId).eq('week_start', weekStart))
    },

    async getPublicShop(code) { return unwrap(await sb.rpc('get_shop_public', { p_code: code })) },
    async getGuestAvailability(code, name, weekStart) {
      return unwrap(await sb.rpc('get_guest_availability', { p_code: code, p_name: name, p_week: weekStart })) as AvailEntry[]
    },
    async submitAvailability(code, name, weekStart, entries) {
      unwrap(await sb.rpc('submit_availability', { p_code: code, p_name: name, p_week: weekStart, p_entries: entries }))
    },
    async claimMember(code, name) { unwrap(await sb.rpc('claim_member', { p_code: code, p_name: name })) },
    async getMembership() {
      const u = (await sb.auth.getSession()).data.session?.user
      if (!u) return null
      const m = unwrap(await sb.from('members').select('*').eq('user_id', u.id).limit(1).maybeSingle()) as Member | null
      if (!m) return null
      const shop = unwrap(await sb.from('shops').select('*').eq('id', m.shop_id).single()) as Shop
      return { shop, member: m }
    },
    async listMyAvailability(memberId, from, to) {
      const rows = unwrap(await sb.from('availability').select('*').eq('member_id', memberId).gte('day', from).lte('day', to)) as Availability[]
      return rows.map((r) => ({ day: r.day, start: r.start_min, end: r.end_min, note: r.note, locations: r.location_ids ?? [] }))
    },
    async listMyShifts(memberId, from, to) {
      return unwrap(await sb.from('shifts').select('*').eq('member_id', memberId).gte('day', from).lte('day', to).order('day').order('start_min')) as Shift[]
    },
  }
}
