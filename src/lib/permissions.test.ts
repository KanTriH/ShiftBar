import { describe, expect, it } from 'vitest'
import { DEFAULT_SHIFT_MANAGER_PERMS, allowedTabs, hasPermission, tabOfPath } from './permissions'

const owner = { isOwner: true, role: 'staff' as const, permissions: {} }
const sm = (permissions: Record<string, boolean>) => ({ isOwner: false, role: 'shift_manager' as const, permissions })
const staff = { isOwner: false, role: 'staff' as const, permissions: { schedule: true } } // 普通员工即使有残留的权限字段也无效

describe('permissions', () => {
  it('the owner can do everything and reaches every tab', () => {
    expect(hasPermission(owner, 'publish')).toBe(true)
    expect(Object.values(allowedTabs(owner)).every(Boolean)).toBe(true)
  })

  it('a shift manager only has the switches that are on', () => {
    const a = sm(DEFAULT_SHIFT_MANAGER_PERMS)
    expect(hasPermission(a, 'schedule')).toBe(true)
    expect(hasPermission(a, 'publish')).toBe(false)
    expect(hasPermission(a, 'manage_staff')).toBe(false)
  })

  it('a plain staff member never has management permissions', () => {
    expect(hasPermission(staff, 'schedule')).toBe(false)
    expect(allowedTabs(staff)).toEqual({ schedule: false, availability: false, staff: false, settings: false, print: false })
  })

  it('settings is owner only, whatever switches are on', () => {
    const all = sm({ schedule: true, publish: true, view_availability: true, manage_staff: true, export_pdf: true })
    expect(allowedTabs(all).settings).toBe(false)
    expect(allowedTabs(all).staff).toBe(true)
  })

  it('publish or export alone is enough to open the schedule tab (read-only)', () => {
    expect(allowedTabs(sm({ publish: true })).schedule).toBe(true)
    expect(allowedTabs(sm({ export_pdf: true })).schedule).toBe(true)
    expect(allowedTabs(sm({ view_availability: true })).schedule).toBe(false)
  })

  it('scheduling also lets them see availability, and print needs export', () => {
    expect(allowedTabs(sm({ schedule: true })).availability).toBe(true)
    expect(allowedTabs(sm({ schedule: true })).print).toBe(false)
    expect(allowedTabs(sm({ export_pdf: true })).print).toBe(true)
  })

  it('maps paths to tabs', () => {
    expect(tabOfPath('/manager')).toBe('schedule')
    expect(tabOfPath('/manager/availability')).toBe('availability')
    expect(tabOfPath('/manager/staff')).toBe('staff')
    expect(tabOfPath('/manager/settings/account')).toBe('settings')
    expect(tabOfPath('/manager/print')).toBe('print')
  })
})
