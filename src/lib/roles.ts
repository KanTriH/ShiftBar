import type { CSSProperties } from 'react'

/** 固定的 6 个岗位色。数据库里的 position.color 存的是各自的"边框色"十六进制值。 */
export const ROLE_IDS = ['clay', 'sage', 'mist', 'plum', 'sand', 'stone'] as const
export type RoleId = typeof ROLE_IDS[number]

export const ROLE_BASE: Record<RoleId, string> = {
  clay: '#a8694a', sage: '#7e8a5c', mist: '#5f7280', plum: '#85667a', sand: '#a08a4c', stone: '#7a7268',
}

/** 打印用（浅色）：fill / border / text */
export const ROLE_PRINT: Record<RoleId, { fill: string; border: string; text: string }> = {
  clay: { fill: '#d9c3b0', border: '#a8694a', text: '#4a2e1f' },
  sage: { fill: '#c9cdb6', border: '#7e8a5c', text: '#3a4128' },
  mist: { fill: '#c8d0d6', border: '#5f7280', text: '#26323b' },
  plum: { fill: '#d6c8d0', border: '#85667a', text: '#3e2a36' },
  sand: { fill: '#e4d9b8', border: '#a08a4c', text: '#4a3e1c' },
  stone: { fill: '#d2ccc4', border: '#7a7268', text: '#332f2a' },
}

/** 旧版本的 8 个颜色 -> 新的岗位色，已有岗位不用迁移数据 */
const LEGACY: Record<string, RoleId> = {
  '#c9532f': 'clay', '#1f7a6d': 'sage', '#3a64c8': 'mist', '#8b4fb3': 'plum',
  '#9a6f0e': 'sand', '#c23b62': 'clay', '#4a7d2b': 'sage', '#4b5563': 'stone',
}

export function roleOf(color: string | null | undefined): RoleId {
  const c = (color ?? '').toLowerCase()
  for (const id of ROLE_IDS) if (ROLE_BASE[id] === c) return id
  return LEGACY[c] ?? 'stone'
}

/** 班次 / 标签的样式：底色、边框、文字都走 CSS 变量，深浅色自动切换 */
export function roleStyle(color: string | null | undefined): CSSProperties {
  const id = roleOf(color)
  return { background: `var(--role-${id}-fill)`, borderColor: `var(--role-${id}-border)`, color: `var(--role-${id}-text)` }
}
/** 小圆点 / 图例色块 */
export const roleDot = (color: string | null | undefined) => `var(--role-${roleOf(color)}-border)`
