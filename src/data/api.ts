import type {
  AppUser, AvailEntry, Availability, Member, MemberStatus, Position, PublicShop, Role, Shift, ShiftInput, Shop, WeekHours,
} from '../lib/types'

export interface Api {
  mode: 'supabase' | 'demo'
  // 账号
  getUser(): Promise<AppUser | null>
  onAuth(cb: (u: AppUser | null) => void): () => void
  signUp(email: string, password: string, role: Role): Promise<void>
  signIn(email: string, password: string): Promise<void>
  signOut(): Promise<void>
  // 店长
  getOwnedShop(): Promise<Shop | null>
  createShop(name: string, positionNames: string[]): Promise<Shop>
  updateShop(id: string, patch: { name?: string; hours?: WeekHours }): Promise<void>
  listPositions(shopId: string): Promise<Position[]>
  createPosition(shopId: string, name: string, color: string): Promise<Position>
  updatePosition(id: string, patch: { name?: string; color?: string }): Promise<void>
  deletePosition(id: string): Promise<void>
  listMembers(shopId: string): Promise<Member[]>
  createMember(shopId: string, name: string, status: MemberStatus): Promise<Member>
  updateMember(id: string, patch: { name?: string; status?: MemberStatus }): Promise<void>
  deleteMember(id: string): Promise<void>
  listAvailability(shopId: string, from: string, to: string): Promise<Availability[]>
  listShifts(shopId: string, from: string, to: string): Promise<Shift[]>
  createShift(shopId: string, input: ShiftInput): Promise<Shift>
  updateShift(id: string, patch: Partial<ShiftInput>): Promise<void>
  deleteShift(id: string): Promise<void>
  listPublished(shopId: string): Promise<string[]>
  setPublished(shopId: string, weekStart: string, on: boolean): Promise<void>
  // 访客 / 员工
  getPublicShop(code: string): Promise<PublicShop | null>
  getGuestAvailability(code: string, name: string, weekStart: string): Promise<AvailEntry[]>
  submitAvailability(code: string, name: string, weekStart: string, entries: AvailEntry[]): Promise<void>
  claimMember(code: string, name: string): Promise<void>
  getMembership(): Promise<{ shop: Shop; member: Member } | null>
  listMyAvailability(memberId: string, from: string, to: string): Promise<AvailEntry[]>
  listMyShifts(memberId: string, from: string, to: string): Promise<Shift[]>
}
