import { describe, expect, it } from 'vitest'
import { POSITION_COLORS } from './types'
import { ROLE_BASE, ROLE_IDS, roleDot, roleOf, roleStyle } from './roles'

describe('role colors', () => {
  it('has exactly six fixed roles and the preset colors map to them in order', () => {
    expect(ROLE_IDS).toHaveLength(6)
    expect(POSITION_COLORS.map(roleOf)).toEqual([...ROLE_IDS])
    expect(POSITION_COLORS).toEqual(ROLE_IDS.map((id) => ROLE_BASE[id]))
  })

  it('maps colors saved by older versions onto the new roles', () => {
    expect(roleOf('#c9532f')).toBe('clay')
    expect(roleOf('#3a64c8')).toBe('mist')
    expect(roleOf('#4B5563')).toBe('stone')
  })

  it('falls back to stone for unknown or missing colors', () => {
    expect(roleOf('#123456')).toBe('stone')
    expect(roleOf(undefined)).toBe('stone')
    expect(roleOf(null)).toBe('stone')
  })

  it('builds styles from CSS variables so light and dark follow the theme', () => {
    expect(roleStyle('#a8694a')).toEqual({ background: 'var(--role-clay-fill)', borderColor: 'var(--role-clay-border)', color: 'var(--role-clay-text)' })
    expect(roleDot('#7e8a5c')).toBe('var(--role-sage-border)')
  })
})
