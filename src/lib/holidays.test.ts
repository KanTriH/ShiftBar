import { afterEach, describe, expect, it } from 'vitest'
import { REGIONS, holidayLabel, holidayName, holidayOn, holidaysOf, regionLabel } from './holidays'
import { setLangValue } from '../i18n/core'

afterEach(() => setLangValue('zh'))

/** 把一个地区某一年的假日整理成 {日期: 英文名} 方便断言 */
const names = (year: number, region: string) => Object.fromEntries([...holidaysOf(year, region)].map(([d, h]) => [d, h.en]))
const dow = (iso: string) => new Date(iso + 'T00:00:00').getDay() // 0 = Sunday

describe('statutory holidays by region (2026)', () => {
  it('Ontario', () => {
    expect(names(2026, 'ON')).toEqual({
      '2026-01-01': "New Year's Day",
      '2026-02-16': 'Family Day',
      '2026-04-03': 'Good Friday',
      '2026-05-18': 'Victoria Day',
      '2026-07-01': 'Canada Day',
      '2026-09-07': 'Labour Day',
      '2026-10-12': 'Thanksgiving',
      '2026-12-25': 'Christmas Day',
      '2026-12-26': 'Boxing Day',
    })
  })

  it('British Columbia has BC Day, Truth and Reconciliation and Remembrance Day but no Boxing Day', () => {
    const bc = names(2026, 'BC')
    expect(bc['2026-08-03']).toBe('BC Day')
    expect(bc['2026-09-30']).toBe('National Day for Truth and Reconciliation')
    expect(bc['2026-11-11']).toBe('Remembrance Day')
    expect(Object.values(bc)).not.toContain('Boxing Day')
    expect(Object.keys(bc)).toHaveLength(11)
  })

  it('Alberta has Remembrance Day but not BC Day, Boxing Day or Truth and Reconciliation', () => {
    const ab = Object.values(names(2026, 'AB'))
    expect(ab).toContain('Remembrance Day')
    expect(ab).not.toContain('BC Day')
    expect(ab).not.toContain('Boxing Day')
    expect(ab).not.toContain('National Day for Truth and Reconciliation')
  })

  it('Saskatchewan Day is the first Monday of August', () => {
    expect(names(2026, 'SK')['2026-08-03']).toBe('Saskatchewan Day')
  })

  it('Quebec uses National Patriots Day and the Fete nationale instead of Victoria Day and Family Day', () => {
    const qc = names(2025, 'QC')
    expect(qc['2025-05-19']).toBe("National Patriots' Day")
    expect(qc['2025-06-24']).toBe('Fête nationale du Québec')
    expect(Object.values(qc)).not.toContain('Victoria Day')
    expect(Object.values(qc)).not.toContain('Family Day')
    expect(qc['2025-04-18']).toBe('Good Friday')
    expect(qc['2025-10-13']).toBe('Thanksgiving')
  })

  it('federal list has ten holidays including Boxing Day and Truth and Reconciliation', () => {
    const ca = holidaysOf(2026, 'CA')
    expect(ca.size).toBe(10)
    expect(Object.values(names(2026, 'CA'))).toContain('Boxing Day')
    expect(Object.values(names(2026, 'CA'))).toContain('National Day for Truth and Reconciliation')
  })
})

describe('moving holidays', () => {
  it('computes Good Friday from Easter, including the earliest and latest Easters', () => {
    const goodFriday = (y: number) => Object.entries(names(y, 'ON')).find(([, n]) => n === 'Good Friday')![0]
    expect(goodFriday(2008)).toBe('2008-03-21') // Easter 2008-03-23
    expect(goodFriday(2024)).toBe('2024-03-29')
    expect(goodFriday(2025)).toBe('2025-04-18')
    expect(goodFriday(2027)).toBe('2027-03-26')
    expect(goodFriday(2038)).toBe('2038-04-23') // Easter 2038-04-25, the latest possible
  })

  it('Victoria Day is the Monday before May 25 (never on May 25 itself)', () => {
    const victoria = (y: number) => Object.entries(names(y, 'ON')).find(([, n]) => n === 'Victoria Day')![0]
    expect(victoria(2026)).toBe('2026-05-18') // May 25 2026 is a Monday, so the holiday is a week earlier
    expect(victoria(2027)).toBe('2027-05-24')
    for (let y = 2020; y <= 2040; y++) {
      const d = victoria(y)
      expect(dow(d)).toBe(1)
      const day = Number(d.slice(8))
      expect(day).toBeGreaterThanOrEqual(18)
      expect(day).toBeLessThanOrEqual(24)
    }
  })

  it('Thanksgiving is always the second Monday of October and Family Day the third Monday of February', () => {
    for (let y = 2020; y <= 2040; y++) {
      const thanks = Object.entries(names(y, 'ON')).find(([, n]) => n === 'Thanksgiving')![0]
      expect(dow(thanks)).toBe(1)
      expect(Number(thanks.slice(8))).toBeGreaterThanOrEqual(8)
      expect(Number(thanks.slice(8))).toBeLessThanOrEqual(14)
      const family = Object.entries(names(y, 'ON')).find(([, n]) => n === 'Family Day')![0]
      expect(dow(family)).toBe(1)
      expect(Number(family.slice(8))).toBeGreaterThanOrEqual(15)
      expect(Number(family.slice(8))).toBeLessThanOrEqual(21)
    }
  })

  it('Labour Day is always the first Monday of September', () => {
    for (let y = 2020; y <= 2040; y++) {
      const labour = Object.entries(names(y, 'ON')).find(([, n]) => n === 'Labour Day')![0]
      expect(dow(labour)).toBe(1)
      expect(Number(labour.slice(8))).toBeLessThanOrEqual(7)
    }
  })
})

describe('holidayOn', () => {
  it('finds a holiday on a given date', () => {
    expect(holidayOn('2026-07-01', 'ON')?.en).toBe('Canada Day')
    expect(holidayOn('2026-07-01', 'ON')?.zh).toBe('加拿大国庆日')
  })
  it('returns null on ordinary days', () => {
    expect(holidayOn('2026-07-02', 'ON')).toBeNull()
  })
  it('returns null when reminders are off, the region is empty or unknown', () => {
    expect(holidayOn('2026-07-01', 'NONE')).toBeNull()
    expect(holidayOn('2026-07-01', '')).toBeNull()
    expect(holidayOn('2026-07-01', 'ZZ')).toBeNull()
  })
  it('respects region differences on the same date', () => {
    expect(holidayOn('2026-12-26', 'ON')?.en).toBe('Boxing Day')
    expect(holidayOn('2026-12-26', 'AB')).toBeNull()
  })
})

describe('labels', () => {
  it('shows Chinese and English together in Chinese mode, English only in English mode', () => {
    const h = holidayOn('2026-07-01', 'CA')!
    expect(holidayLabel(h)).toBe('加拿大国庆日 Canada Day')
    expect(holidayName(h)).toBe('加拿大国庆日')
    setLangValue('en')
    expect(holidayLabel(h)).toBe('Canada Day')
    expect(holidayName(h)).toBe('Canada Day')
  })

  it('every region has a label in both languages and the list ends with the "off" option', () => {
    for (const r of REGIONS) {
      expect(r.zh.length).toBeGreaterThan(0)
      expect(r.en.length).toBeGreaterThan(0)
    }
    expect(REGIONS.at(-1)!.value).toBe('NONE')
    expect(regionLabel(REGIONS[1])).toBe('安大略 Ontario')
    setLangValue('en')
    expect(regionLabel(REGIONS[1])).toBe('Ontario')
  })
})
