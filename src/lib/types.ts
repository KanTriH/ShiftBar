export interface DayHours { open: number; close: number }
/** 下标 0 = 周一 ... 6 = 周日；null = 休息 */
export type WeekHours = (DayHours | null)[]

export interface Shop { id: string; name: string; code: string; hours: WeekHours }
export interface Position { id: string; shop_id: string; name: string; color: string; sort: number }
export type MemberStatus = 'trial' | 'regular'
export interface Member { id: string; shop_id: string; name: string; status: MemberStatus; user_id: string | null }
export interface Availability { id: string; shop_id: string; member_id: string; day: string; start_min: number; end_min: number; note: string }
export interface Shift { id: string; shop_id: string; member_id: string; position_id: string | null; day: string; start_min: number; end_min: number; note: string }
export interface AvailEntry { day: string; start: number; end: number; note: string }
export interface ShiftInput { member_id: string; position_id: string | null; day: string; start_min: number; end_min: number; note?: string }
export type Role = 'manager' | 'staff'
export interface AppUser { id: string; email: string; role: Role | null }
export interface PublicShop { name: string; hours: WeekHours; members: { name: string; claimed: boolean }[] }

export const DEFAULT_HOURS: DayHours[] = Array.from({ length: 7 }, () => ({ open: 9 * 60, close: 22 * 60 }))

export const POSITION_COLORS = ['#c9532f', '#1f7a6d', '#3a64c8', '#8b4fb3', '#9a6f0e', '#c23b62', '#4a7d2b', '#4b5563']

export const POSITION_PRESETS: { label: string; items: string[] }[] = [
  { label: '奶茶 / 咖啡店', items: ['prep', 'bar', 'cashier'] },
  { label: '餐厅', items: ['kitchen', 'front', 'host'] },
  { label: '零售店', items: ['floor', 'cashier', 'stock'] },
]
