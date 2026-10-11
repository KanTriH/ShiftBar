import type { MemberRole } from './types'

/** Shift manager 的 5 个权限开关。店长拥有全部，不需要开关。数据库里的同名判断见迁移 0007 */
export const PERMISSION_KEYS = ['schedule', 'publish', 'view_availability', 'manage_staff', 'export_pdf'] as const
export type Permission = typeof PERMISSION_KEYS[number]
export type Permissions = Partial<Record<Permission, boolean>>

/** 把员工设为 shift manager 时的默认开关：能排班、看可用时间、导出；发布和管理员工要店长单独打开 */
export const DEFAULT_SHIFT_MANAGER_PERMS: Permissions = { schedule: true, view_availability: true, export_pdf: true }

export interface Actor { isOwner: boolean; role: MemberRole; permissions: Permissions }

export const hasPermission = (a: Actor, p: Permission) => a.isOwner || (a.role === 'shift_manager' && a.permissions[p] === true)

/** 管理页各个标签谁能进（"设置"只有店长） */
export function allowedTabs(a: Actor) {
  const has = (p: Permission) => hasPermission(a, p)
  return {
    schedule: a.isOwner || has('schedule') || has('publish') || has('export_pdf'),
    availability: a.isOwner || has('view_availability') || has('schedule'),
    staff: a.isOwner || has('manage_staff'),
    settings: a.isOwner,
    print: a.isOwner || has('export_pdf'),
  }
}

/** 一条管理页路径对应的是哪个标签 */
export function tabOfPath(pathname: string): keyof ReturnType<typeof allowedTabs> {
  if (pathname.startsWith('/manager/print')) return 'print'
  if (pathname.startsWith('/manager/availability')) return 'availability'
  if (pathname.startsWith('/manager/staff')) return 'staff'
  if (pathname.startsWith('/manager/settings')) return 'settings'
  return 'schedule'
}
