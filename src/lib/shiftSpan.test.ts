import { describe, expect, it } from 'vitest'
import { absSpan, spansOverlap } from './shiftSpan'

const s = (day: string, start_min: number, end_min: number) => ({ day, start_min, end_min })

describe('shift spans', () => {
  it('the same day: overlapping and disjoint', () => {
    expect(spansOverlap(s('2026-10-05', 540, 900), s('2026-10-05', 720, 1000))).toBe(true)
    expect(spansOverlap(s('2026-10-05', 540, 600), s('2026-10-05', 700, 800))).toBe(false)
  })

  it('back-to-back shifts do not overlap', () => {
    expect(spansOverlap(s('2026-10-05', 540, 720), s('2026-10-05', 720, 900))).toBe(false)
  })

  it('an overnight shift overlaps the next morning', () => {
    const night = s('2026-10-05', 1260, 1560) // 21:00 到次日 02:00
    expect(spansOverlap(night, s('2026-10-06', 60, 180))).toBe(true) // 次日 01:00 - 03:00
    expect(spansOverlap(night, s('2026-10-06', 120, 240))).toBe(false) // 02:00 刚好接上
  })

  it('handles month and year boundaries', () => {
    expect(spansOverlap(s('2026-10-31', 1380, 1500), s('2026-11-01', 30, 90))).toBe(true)
    expect(spansOverlap(s('2026-12-31', 1380, 1500), s('2027-01-01', 30, 90))).toBe(true)
    expect(spansOverlap(s('2026-10-05', 540, 900), s('2026-10-06', 540, 900))).toBe(false)
  })

  it('gives increasing positions for later days', () => {
    expect(absSpan(s('2026-10-06', 0, 60))[0] - absSpan(s('2026-10-05', 0, 60))[0]).toBe(1440)
  })
})
