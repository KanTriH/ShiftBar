import { describe, expect, it } from 'vitest'
import { buildIcs } from './ics'
import type { IcsEvent } from './ics'

const lines = (events: IcsEvent[], name = 'cal') => buildIcs(events, name).split('\r\n')

describe('buildIcs', () => {
  it('wraps events in a calendar with CRLF line endings', () => {
    const text = buildIcs([{ id: 'a', day: '2026-10-09', start: 540, end: 900, title: 'Shift' }], 'My shop')
    expect(text.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(text.endsWith('END:VCALENDAR')).toBe(true)
    expect(text).toContain('X-WR-CALNAME:My shop')
    expect(text.split('BEGIN:VEVENT')).toHaveLength(2)
    expect(text).not.toMatch(/[^\r]\n/) // no bare LF
  })

  it('writes floating local times for a normal same-day shift', () => {
    const l = lines([{ id: 'a', day: '2026-10-09', start: 540, end: 900, title: 'Shift' }])
    expect(l).toContain('DTSTART:20261009T090000')
    expect(l).toContain('DTEND:20261009T150000')
    expect(l).toContain('UID:a@shift-scheduler')
  })

  it('puts the end of an overnight shift on the next date', () => {
    const l = lines([{ id: 'a', day: '2026-10-09', start: 1110, end: 1500, title: 'Night' }])
    expect(l).toContain('DTSTART:20261009T183000')
    expect(l).toContain('DTEND:20261010T010000')
  })

  it('rolls over month and year ends', () => {
    expect(lines([{ id: 'a', day: '2026-12-31', start: 1200, end: 1500, title: 'NYE' }])).toContain('DTEND:20270101T010000')
    expect(lines([{ id: 'a', day: '2026-10-31', start: 1200, end: 1500, title: 'x' }])).toContain('DTEND:20261101T010000')
  })

  it('a shift ending exactly at midnight ends at 00:00 of the next day', () => {
    expect(lines([{ id: 'a', day: '2026-10-09', start: 540, end: 1440, title: 'x' }])).toContain('DTEND:20261010T000000')
  })

  it('escapes commas, semicolons, backslashes and newlines', () => {
    const l = lines([{ id: 'a', day: '2026-10-09', start: 540, end: 900, title: 'Shop, North; A\\B', note: 'line1\nline2' }])
    expect(l).toContain('SUMMARY:Shop\\, North\\; A\\\\B')
    expect(l).toContain('DESCRIPTION:line1\\nline2')
  })

  it('omits DESCRIPTION when there is no note', () => {
    expect(buildIcs([{ id: 'a', day: '2026-10-09', start: 540, end: 900, title: 'x' }], 'c')).not.toContain('DESCRIPTION')
  })

  it('writes one VEVENT per shift', () => {
    const text = buildIcs([
      { id: 'a', day: '2026-10-09', start: 540, end: 900, title: 'x' },
      { id: 'b', day: '2026-10-10', start: 540, end: 900, title: 'y' },
      { id: 'c', day: '2026-10-11', start: 540, end: 900, title: 'z' },
    ], 'c')
    expect(text.match(/BEGIN:VEVENT/g)).toHaveLength(3)
    expect(text.match(/END:VEVENT/g)).toHaveLength(3)
  })
})
