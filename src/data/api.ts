import type {
  AppUser, AvailEntry, Availability, DailyTask, Location, Member, MemberStatus, PdfStyle, Position, PublicShop, Role,
  MemberPosition, Shift, ShiftInput, Shop, WeekHours, WeekStartDay,
} from '../lib/types'

export interface ShopPatch { name?: string; hours?: WeekHours; week_start?: WeekStartDay; region?: string; pdf_style?: PdfStyle; code_enabled?: boolean }

export interface Api {
  mode: 'supabase' | 'demo'
  // 账号
  getUser(): Promise<AppUser | null>
  onAuth(cb: (u: AppUser | null) => void): () => void
  signUp(email: string, password: string, role: Role): Promise<void>
  signIn(email: string, password: string): Promise<void>
  signOut(): Promise<void>
  /** 发送重置密码邮件（链接指向 /reset-password） */
  requestPasswordReset(email: string): Promise<void>
  /** 设置新密码：用于重置链接带来的登录状态，或已登录用户 */
  updatePassword(newPassword: string): Promise<void>
  /** 彻底注销当前账号并删除其全部数据，之后会自动退出登录 */
  deleteAccount(): Promise<void>
  // 店长
  getOwnedShop(): Promise<Shop | null>
  createShop(name: string, positionNames: string[]): Promise<Shop>
  updateShop(id: string, patch: ShopPatch): Promise<void>
  listLocations(shopId: string): Promise<Location[]>
  createLocation(shopId: string, name: string): Promise<Location>
  updateLocation(id: string, patch: { name?: string }): Promise<void>
  deleteLocation(id: string): Promise<void>
  listPositions(shopId: string): Promise<Position[]>
  createPosition(shopId: string, name: string, color: string): Promise<Position>
  updatePosition(id: string, patch: { name?: string; color?: string }): Promise<void>
  deletePosition(id: string): Promise<void>
  listMembers(shopId: string): Promise<Member[]>
  createMember(shopId: string, name: string, status: MemberStatus): Promise<Member>
  updateMember(id: string, patch: { name?: string; status?: MemberStatus }): Promise<void>
  deleteMember(id: string): Promise<void>
  /** 店长：整家店的技能矩阵；员工：只有自己的几行 */
  listMemberPositions(shopId: string): Promise<MemberPosition[]>
  setMemberPosition(shopId: string, memberId: string, positionId: string, on: boolean): Promise<void>
  listAvailability(shopId: string, from: string, to: string): Promise<Availability[]>
  listShifts(shopId: string, from: string, to: string): Promise<Shift[]>
  createShift(shopId: string, input: ShiftInput): Promise<Shift>
  updateShift(id: string, patch: Partial<ShiftInput>): Promise<void>
  deleteShift(id: string): Promise<void>
  listDailyTasks(shopId: string, from: string, to: string): Promise<DailyTask[]>
  /** text 为空会删除该条 */
  setDailyTask(shopId: string, locationId: string, day: string, text: string): Promise<void>
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
