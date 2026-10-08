import { afterEach, describe, expect, it } from 'vitest'
import {
  addDays, clamp, covers, dayLabel, fmtDay, fmtHours, fmtMD, fmtMin, fmtRangeShort, fromISO, inputTime, isNextDay,
  mergeIntervals, monthEnd, monthStart, parseEndAfter, parseHM, parseStartIn, snap, toISO, weekDays, weekStart, weekdayIdx,
} from './time'
import { setLangValue } from '../i18n/core'

afterEach(() => setLangValue('zh'))

describe('week boundaries', () => {
  it('starts the week on Monday by default', () => {
    expect(weekStart('2026-10-07')).toBe('2026-10-05') // Wed -> Mon
    expect(weekStart('2026-10-05')).toBe('2026-10-05') // Monday stays
    expect(weekStart('2026-10-04')).toBe('2026-09-28') // Sunday belongs to the week that began the previous Monday
  })

  it('can start the week on Sunday', () => {
    expect(weekStart('2026-10-07', 0)).toBe('2026-10-04')
    expect(weekStart('2026-10-04', 0)).toBe('2026-10-04') // Sunday stays
    expect(weekStart('2026-10-05', 0)).toBe('2026-10-04') // Monday belongs to the Sunday-start week
  })

  it('crosses year boundaries', () => {
    expect(weekStart('2026-01-01')).toBe('2025-12-29')
    expect(weekStart('2026-01-01', 0)).toBe('2025-12-28')
  })

  it('weekdayIdx is Monday = 0 ... Sunday = 6 regardless of the week-start setting', () => {
    expect(weekdayIdx('2026-10-05')).toBe(0)
    expect(weekdayIdx('2026-10-09')).toBe(4)
    expect(weekdayIdx('2026-10-04')).toBe(6)
  })

  it('weekDays returns seven consecutive days', () => {
    const d = weekDays('2026-10-04')
    expect(d).toHaveLength(7)
    expect(d[0]).toBe('2026-10-04')
    expect(d[6]).toBe('2026-10-10')
  })
})

describe('date arithmetic', () => {
  it('adds days across month, year, leap day and DST changes', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2026-03-07', 2)).toBe('2026-03-09') // US DST starts 2026-03-08
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02') // US DST ends 2026-11-01
    expect(addDays('2026-10-05', -7)).toBe('2026-09-28')
  })

  it('round-trips ISO strings', () => {
    expect(toISO(fromISO('2026-02-03'))).toBe('2026-02-03')
  })

  it('finds month start and end, including leap years', () => {
    expect(monthStart('2026-10-17')).toBe('2026-10-01')
    expect(monthEnd('2026-10-17')).toBe('2026-10-31')
    expect(monthEnd('2026-02-10')).toBe('2026-02-28')
    expect(monthEnd('2028-02-10')).toBe('2028-02-29')
    expect(monthEnd('2026-12-05')).toBe('2026-12-31')
  })
})

describe('minute formatting', () => {
  it('formats minutes as HH:MM', () => {
    expect(fmtMin(0)).toBe('00:00')
    expect(fmtMin(545)).toBe('09:05')
    expect(fmtMin(1439)).toBe('23:59')
  })

  it('shows 24:00 for exactly midnight and wraps past-midnight times', () => {
    expect(fmtMin(1440)).toBe('24:00')
    expect(fmtMin(1470)).toBe('00:30')
    expect(fmtMin(1500)).toBe('01:00')
  })

  it('inputTime never produces 24:00 (not valid for <input type="time">)', () => {
    expect(inputTime(1440)).toBe('00:00')
    expect(inputTime(1500)).toBe('01:00')
    expect(inputTime(540)).toBe('09:00')
  })

  it('isNextDay is true only after midnight', () => {
    expect(isNextDay(1440)).toBe(false)
    expect(isNextDay(1441)).toBe(true)
    expect(isNextDay(600)).toBe(false)
  })

  it('formats hours without trailing zeros', () => {
    expect(fmtHours(480)).toBe('8')
    expect(fmtHours(450)).toBe('7.5')
    expect(fmtHours(0)).toBe('0')
  })
})

describe('parsing time input', () => {
  it('parses HH:MM', () => {
    expect(parseHM('09:30')).toBe(570)
    expect(parseHM('00:00')).toBe(0)
    expect(parseHM('00:00', true)).toBe(1440) // as an end time, midnight means end of day
    expect(parseHM('09:30', true)).toBe(570)
  })

  it('treats an end time not later than the start as the next day', () => {
    expect(parseEndAfter('01:00', 1065)).toBe(1500) // 17:45 - 01:00
    expect(parseEndAfter('00:00', 1020)).toBe(1440) // 17:00 - midnight
    expect(parseEndAfter('22:00', 1020)).toBe(1320) // ordinary same-day end
    expect(parseEndAfter('17:00', 1020)).toBe(1020 + 1440) // same clock time = 24 hours later
  })

  it('treats a start time earlier than opening as after midnight', () => {
    expect(parseStartIn('01:00', 540)).toBe(1500) // shop opens 09:00, so 01:00 is next-day 01:00
    expect(parseStartIn('10:00', 540)).toBe(600)
    expect(parseStartIn('09:00', 540)).toBe(540)
  })

  it('only reads an early start as "next day" when the shop actually stays open past midnight', () => {
    expect(parseStartIn('01:00', 540, 1500)).toBe(1500) // 营业到次日 01:00
    expect(parseStartIn('05:00', 540, 1320)).toBe(300) // 22:00 关门：05:00 就是 05:00，随后会被判定为不在营业时间内
    expect(parseStartIn('05:00', 600, 1440)).toBe(300) // 营业到午夜整点，同样不换算
    expect(parseStartIn('10:00', 600, 1500)).toBe(600) // 不早于开门，永远不换算
  })
})

describe('intervals', () => {
  it('merges overlapping, adjacent, unsorted and contained ranges', () => {
    expect(mergeIntervals([[600, 700], [650, 800]])).toEqual([[600, 800]])
    expect(mergeIntervals([[600, 700], [700, 800]])).toEqual([[600, 800]]) // touching ranges join
    expect(mergeIntervals([[900, 1000], [600, 700]])).toEqual([[600, 700], [900, 1000]])
    expect(mergeIntervals([[600, 1000], [700, 800]])).toEqual([[600, 1000]])
    expect(mergeIntervals([])).toEqual([])
  })

  it('does not modify its input', () => {
    const input: [number, number][] = [[600, 700], [650, 800]]
    mergeIntervals(input)
    expect(input).toEqual([[600, 700], [650, 800]])
  })

  it('covers is inclusive at both ends', () => {
    const m = mergeIntervals([[600, 900]])
    expect(covers(m, 600, 900)).toBe(true)
    expect(covers(m, 599, 900)).toBe(false)
    expect(covers(m, 600, 901)).toBe(false)
    expect(covers([], 600, 700)).toBe(false)
  })

  it('a range spanning two merged ranges is not covered unless they touch', () => {
    expect(covers(mergeIntervals([[600, 700], [720, 900]]), 650, 800)).toBe(false)
    expect(covers(mergeIntervals([[600, 700], [700, 900]]), 650, 800)).toBe(true)
  })
})

describe('snap and clamp', () => {
  it('snaps to 15 minutes', () => {
    expect(snap(547)).toBe(540)
    expect(snap(548)).toBe(555)
    expect(snap(547, 30)).toBe(540)
  })
  it('clamps', () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(-1, 0, 10)).toBe(0)
    expect(clamp(11, 0, 10)).toBe(10)
  })
})

describe('localized labels', () => {
  it('formats dates in Chinese and English', () => {
    expect(fmtDay('2026-10-05')).toBe('10月5日')
    expect(fmtRangeShort('2026-10-05', '2026-10-11')).toBe('10月5日 - 10月11日')
    setLangValue('en')
    expect(fmtDay('2026-10-05')).toBe('Oct 5')
    expect(fmtRangeShort('2026-10-05', '2026-10-11')).toBe('Oct 5 - Oct 11')
  })

  it('fmtMD is the same in both languages', () => {
    expect(fmtMD('2026-10-05')).toBe('10/5')
    setLangValue('en')
    expect(fmtMD('2026-10-05')).toBe('10/5')
  })

  it('names the weekdays in the current language', () => {
    expect(dayLabel(0)).toBe('周一')
    expect(dayLabel(6)).toBe('周日')
    setLangValue('en')
    expect(dayLabel(0)).toBe('Mon')
    expect(dayLabel(6)).toBe('Sun')
  })
})
