import { describe, expect, it } from 'vitest'
import { homeFor, isStaffInWrongPlace } from './landing'
import type { Role } from './types'

const roles: (Role | null)[] = ['manager', 'staff', null]

describe('homeFor (where "my page" goes after sign-in)', () => {
  it('an owner always goes to the manager page, whatever role they signed up with', () => {
    for (const role of roles) expect(homeFor({ hasOwnedShop: true, hasMembership: false, role })).toBe('/manager')
  })

  it('a linked staff member goes to the staff page, even if their sign-up role says manager', () => {
    for (const role of roles) expect(homeFor({ hasOwnedShop: false, hasMembership: true, role })).toBe('/me')
  })

  it('a brand-new account follows the role it signed up with', () => {
    expect(homeFor({ hasOwnedShop: false, hasMembership: false, role: 'manager' })).toBe('/manager') // create a shop
    expect(homeFor({ hasOwnedShop: false, hasMembership: false, role: 'staff' })).toBe('/me') // link to a shop
    expect(homeFor({ hasOwnedShop: false, hasMembership: false, role: null })).toBe('/me')
  })

  it('owning a shop wins over also being a staff member somewhere', () => {
    expect(homeFor({ hasOwnedShop: true, hasMembership: true, role: 'staff' })).toBe('/manager')
  })
})

describe('isStaffInWrongPlace (a linked staff member who landed on the create-shop page)', () => {
  it('is true for a linked staff member without a shop of their own', () => {
    expect(isStaffInWrongPlace({ hasOwnedShop: false, hasMembership: true })).toBe(true)
  })

  it('is false for a new manager with nothing yet (they should see "create your shop")', () => {
    expect(isStaffInWrongPlace({ hasOwnedShop: false, hasMembership: false })).toBe(false)
  })

  it('is false for someone who signed up as staff by mistake but never linked a shop (they can still create one)', () => {
    expect(isStaffInWrongPlace({ hasOwnedShop: false, hasMembership: false })).toBe(false)
  })

  it('is false for an owner, even if they are also a member somewhere', () => {
    expect(isStaffInWrongPlace({ hasOwnedShop: true, hasMembership: true })).toBe(false)
    expect(isStaffInWrongPlace({ hasOwnedShop: true, hasMembership: false })).toBe(false)
  })
})
