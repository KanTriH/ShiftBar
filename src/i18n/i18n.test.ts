// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { EN } from './en'
import { getLang, setLangValue, translate } from './core'
import { DAY_LABELS } from '../lib/time'
import { POSITION_PRESETS } from '../lib/types'
import { ERROR_MESSAGES } from '../lib/errors'

afterEach(() => { setLangValue('zh'); localStorage.clear() })

describe('translate', () => {
  it('returns the Chinese source text in Chinese mode', () => {
    setLangValue('zh')
    expect(translate('保存')).toBe('保存')
    expect(translate('登录')).toBe('登录')
  })

  it('looks the text up in the dictionary in English mode', () => {
    setLangValue('en')
    expect(translate('登录')).toBe('Log in')
    expect(translate('员工')).toBe('Staff')
  })

  it('falls back to the Chinese text when there is no translation', () => {
    setLangValue('en')
    expect(translate('这句话没有翻译')).toBe('这句话没有翻译')
  })

  it('fills {placeholders} in both languages, including repeated ones and numbers', () => {
    expect(translate('{n} 人可上', { n: 3 })).toBe('3 人可上')
    setLangValue('en')
    expect(translate('{n} 人可上', { n: 3 })).toBe('3 available')
    expect(translate('请在营业时间内填写（{a} - {b}）', { a: '09:00', b: '22:00' })).toBe('Please stay within opening hours (09:00 - 22:00)')
  })

  it('leaves unknown placeholders alone and tolerates special characters in values', () => {
    expect(translate('删除 {name}', { other: 'x' })).toBe('删除 {name}')
    expect(translate('删除 {name}', { name: '$& \\ {n}' })).toBe('删除 $& \\ {n}')
  })
})

describe('language setting', () => {
  it('stores the choice and sets the document language', () => {
    setLangValue('en')
    expect(getLang()).toBe('en')
    expect(localStorage.getItem('shift-lang')).toBe('en')
    expect(document.documentElement.lang).toBe('en')
    setLangValue('zh')
    expect(localStorage.getItem('shift-lang')).toBe('zh')
    expect(document.documentElement.lang).toBe('zh-CN')
  })
})

/* ---------------------------------------------------------------------------
 * 词典完整性：以后新增界面文案漏了英文，这里会直接报错。
 * 做法：扫描所有源码里的 t('…') / tr('…') / translate('…')，核对 en.ts。
 * ------------------------------------------------------------------------- */
const sources = import.meta.glob(['/src/**/*.{ts,tsx}', '!/src/**/*.test.ts', '!/src/i18n/en.ts', '!/src/i18n/core.ts'], {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>

// 汉字 + 中日韩标点 + 全角符号（比如 、 ； ？）
const CJK = /[　-〿一-鿿＀-￯]/
const CALL = /\b(?:t|tr|translate)\(\s*(?:'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)")/g
const unescape = (s: string) => s.replace(/\\(['"\\])/g, '$1').replace(/\\n/g, '\n')

const usedInCode = new Map<string, string>() // key -> 第一个用到它的文件
for (const [file, src] of Object.entries(sources)) {
  for (const m of src.matchAll(CALL)) {
    const key = unescape(m[1] ?? m[2])
    if (CJK.test(key) && !usedInCode.has(key)) usedInCode.set(key, file)
  }
}

// 这些文案不是直接写在 t('…') 里，而是存在变量/常量里，渲染时才翻译，扫描源码找不到
const indirect = new Set<string>([
  ...DAY_LABELS,
  ...POSITION_PRESETS.map((p) => p.label),
  ...Object.values(ERROR_MESSAGES),
  '排班', '可用时间', '员工', '设置', // 店长顶栏标签（ManagerLayout 的 TABS）
  '序号 NO.', '姓名 Name', '上班 Start', '下班 End', '岗位 Positions', // PDF 表格样式的表头
  '日期 DATE', '姓名 NAME', '状态', '备注 NOTE', '时段 TIME SLOT', // PDF 时间条样式的表头
])

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

describe('English dictionary', () => {
  it('scans a realistic number of source files and keys (guards against the scan silently finding nothing)', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(20)
    expect(usedInCode.size).toBeGreaterThan(150)
  })

  it('has an English entry for every text used in the UI', () => {
    const missing = [...usedInCode].filter(([key]) => !(key in EN)).map(([key, file]) => `${key}  (${file})`)
    expect(missing).toEqual([])
  })

  it('has an English entry for texts translated indirectly (weekday names, presets, error messages, PDF headers)', () => {
    expect([...indirect].filter((key) => !(key in EN))).toEqual([])
  })

  it('has no leftover entries that nothing uses', () => {
    const unused = Object.keys(EN).filter((key) => !usedInCode.has(key) && !indirect.has(key))
    expect(unused).toEqual([])
  })

  it('uses the same {placeholders} as the Chinese text', () => {
    const mismatched = Object.entries(EN).filter(([zh, en]) => placeholders(zh).join() !== placeholders(en).join()).map(([zh]) => zh)
    expect(mismatched).toEqual([])
  })

  it('contains no Chinese characters in the English text', () => {
    const leaked = Object.entries(EN).filter(([, en]) => /[\u4e00-\u9fff]/.test(en)).map(([zh]) => zh)
    expect(leaked).toEqual([])
  })

  it('has no empty translations', () => {
    expect(Object.entries(EN).filter(([, en]) => en.trim() === '').map(([zh]) => zh)).toEqual([])
  })
})
