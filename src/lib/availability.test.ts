import { describe, expect, it } from 'vitest'
import { validateWeek } from './availability'
import type { DayInput } from './availability'
import type { DayHours } from './types'

const WEEK = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11']
const OPEN: DayHours = { open: 540, close: 1320 } // 09:00 - 22:00
const day = (ranges: [number, number][], note = '', locs: string[] = []): DayInput => ({ ranges, note, locs })

const validate = (state: Record<string, DayInput>, hours: (d: string) => DayHours | null = () => OPEN) => validateWeek(WEEK, state, hours)

describe('validateWeek', () => {
  it('returns nothing for an empty form (unfilled days mean "not available")', () => {
    expect(validate({})).toEqual({ errors: {}, entries: [] })
    expect(validate({ '2026-10-05': day([]) })).toEqual({ errors: {}, entries: [] })
  })

  it('turns valid ranges into entries carrying the day note and locations', () => {
    const { errors, entries } = validate({ '2026-10-05': day([[600, 900]], 'class at noon', ['north']) })
    expect(errors).toEqual({})
    expect(entries).toEqual([{ day: '2026-10-05', start: 600, end: 900, note: 'class at noon', locations: ['north'] }])
  })

  it('merges overlapping and touching ranges on the same day', () => {
    const { entries } = validate({ '2026-10-05': day([[600, 800], [700, 900], [900, 1000], [1100, 1200]]) })
    expect(entries.map((e) => [e.start, e.end])).toEqual([[600, 1000], [1100, 1200]])
  })

  it('accepts the whole opening window ("all day")', () => {
    expect(validate({ '2026-10-05': day([[540, 1320]]) }).errors).toEqual({})
  })

  it('rejects a range that ends before or at its start', () => {
    expect(validate({ '2026-10-05': day([[900, 600]]) }).errors['2026-10-05']).toEqual({ kind: 'order' })
    expect(validate({ '2026-10-05': day([[900, 900]]) }).errors['2026-10-05']).toEqual({ kind: 'order' })
  })

  it('rejects ranges outside opening hours and reports the hours', () => {
    expect(validate({ '2026-10-05': day([[500, 900]]) }).errors['2026-10-05']).toEqual({ kind: 'outsideHours', open: 540, close: 1320 })
    expect(validate({ '2026-10-05': day([[600, 1321]]) }).errors['2026-10-05']).toEqual({ kind: 'outsideHours', open: 540, close: 1320 })
  })

  it('rejects availability on a day the shop is closed', () => {
    const closedOnTue = (d: string) => (d === '2026-10-06' ? null : OPEN)
    expect(validate({ '2026-10-06': day([[600, 900]]) }, closedOnTue).errors['2026-10-06']).toEqual({ kind: 'closed' })
  })

  it('ignores a closed day that was left empty', () => {
    expect(validate({ '2026-10-06': day([]) }, () => null)).toEqual({ errors: {}, entries: [] })
  })

  it('a bad day produces no entries but other good days still do (caller blocks the submit on errors)', () => {
    const { errors, entries } = validate({
      '2026-10-05': day([[900, 600]]),
      '2026-10-06': day([[600, 900]]),
    })
    expect(Object.keys(errors)).toEqual(['2026-10-05'])
    expect(entries.map((e) => e.day)).toEqual(['2026-10-06'])
  })

  it('supports shops that close after midnight', () => {
    const lateShop = () => ({ open: 540, close: 1500 }) // closes 01:00 next day
    expect(validate({ '2026-10-09': day([[1110, 1500]]) }, lateShop).errors).toEqual({})
    expect(validate({ '2026-10-09': day([[1110, 1560]]) }, lateShop).errors['2026-10-09']).toEqual({ kind: 'outsideHours', open: 540, close: 1500 })
  })

  it('validates each day against that day’s own hours', () => {
    const weekendLater = (d: string) => (d >= '2026-10-10' ? { open: 600, close: 1380 } : OPEN)
    expect(validate({ '2026-10-10': day([[1330, 1380]]) }, weekendLater).errors).toEqual({})
    expect(validate({ '2026-10-09': day([[1330, 1380]]) }, weekendLater).errors['2026-10-09']).toMatchObject({ kind: 'outsideHours' })
  })
})
