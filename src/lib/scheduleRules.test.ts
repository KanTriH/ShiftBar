import { describe, expect, it } from 'vitest'
import { computeShiftIssues } from './scheduleRules'
import type { Availability, Shift } from './types'

let n = 0
const shift = (member: string, start: number, end: number, extra: Partial<Shift> = {}): Shift => ({
  id: `s${++n}`, shop_id: 'shop', member_id: member, position_id: null, location_id: 'main', day: '2026-10-05', start_min: start, end_min: end, note: '', ...extra,
})
const avail = (member: string, start: number, end: number): Availability => ({
  id: `a${++n}`, shop_id: 'shop', member_id: member, day: '2026-10-05', start_min: start, end_min: end, note: '', location_ids: [],
})
const run = (o: { shifts: Shift[]; otherShifts?: Shift[]; avail?: Availability[]; submitted?: string[] }) =>
  computeShiftIssues({ shifts: o.shifts, otherShifts: o.otherShifts ?? [], avail: o.avail ?? [], submitted: new Set(o.submitted ?? []) })

describe('computeShiftIssues', () => {
  it('reports nothing for a shift inside the person’s availability', () => {
    const s = shift('lin', 600, 900)
    expect(run({ shifts: [s], avail: [avail('lin', 540, 1020)], submitted: ['lin'] }).size).toBe(0)
  })

  it('flags a shift that goes outside the availability', () => {
    const s = shift('lin', 600, 1100)
    expect(run({ shifts: [s], avail: [avail('lin', 540, 1020)], submitted: ['lin'] }).get(s.id)).toEqual([{ kind: 'outsideAvailability' }])
  })

  it('flags a shift on a day the person submitted for the week but has no availability', () => {
    const s = shift('lin', 600, 900)
    expect(run({ shifts: [s], avail: [], submitted: ['lin'] }).get(s.id)).toEqual([{ kind: 'outsideAvailability' }])
  })

  it('does not judge availability for people who never submitted (we do not know when they are free)', () => {
    const s = shift('guest', 600, 900)
    expect(run({ shifts: [s], avail: [], submitted: [] }).size).toBe(0)
  })

  it('treats touching availability ranges as continuous', () => {
    const s = shift('lin', 600, 900)
    expect(run({ shifts: [s], avail: [avail('lin', 540, 720), avail('lin', 720, 1000)], submitted: ['lin'] }).size).toBe(0)
  })

  it('flags a shift spanning a gap between two availability ranges', () => {
    const s = shift('lin', 600, 900)
    expect(run({ shifts: [s], avail: [avail('lin', 540, 700), avail('lin', 760, 1000)], submitted: ['lin'] }).has(s.id)).toBe(true)
  })

  it('only uses the shift owner’s own availability', () => {
    const s = shift('lin', 600, 900)
    expect(run({ shifts: [s], avail: [avail('zhou', 540, 1020)], submitted: ['lin', 'zhou'] }).has(s.id)).toBe(true)
  })

  it('flags both shifts when the same person has overlapping shifts', () => {
    const a = shift('lin', 600, 900)
    const b = shift('lin', 800, 1000)
    const r = run({ shifts: [a, b] })
    expect(r.get(a.id)).toEqual([{ kind: 'overlap' }])
    expect(r.get(b.id)).toEqual([{ kind: 'overlap' }])
  })

  it('does not flag back-to-back shifts (one ends exactly when the next starts)', () => {
    expect(run({ shifts: [shift('lin', 600, 900), shift('lin', 900, 1000)] }).size).toBe(0)
  })

  it('does not flag overlapping shifts of different people', () => {
    expect(run({ shifts: [shift('lin', 600, 900), shift('zhou', 600, 900)] }).size).toBe(0)
  })

  it('flags a clash with a shift at another location and says which one', () => {
    const s = shift('lin', 600, 900)
    const other = shift('lin', 800, 1000, { location_id: 'north' })
    expect(run({ shifts: [s], otherShifts: [other] }).get(s.id)).toEqual([{ kind: 'otherLocation', locationId: 'north' }])
  })

  it('allows the same person at two locations when the times do not overlap', () => {
    const s = shift('lin', 600, 900)
    const other = shift('lin', 900, 1000, { location_id: 'north' })
    expect(run({ shifts: [s], otherShifts: [other] }).size).toBe(0)
  })

  it('ignores other people’s shifts at other locations', () => {
    const s = shift('lin', 600, 900)
    expect(run({ shifts: [s], otherShifts: [shift('zhou', 600, 900, { location_id: 'north' })] }).size).toBe(0)
  })

  it('reports every problem on one shift', () => {
    const s = shift('lin', 600, 1100)
    const dup = shift('lin', 700, 800)
    const other = shift('lin', 1000, 1200, { location_id: 'north' })
    const kinds = run({ shifts: [s, dup], otherShifts: [other], avail: [avail('lin', 540, 900)], submitted: ['lin'] }).get(s.id)!.map((i) => i.kind)
    expect(kinds).toEqual(['overlap', 'otherLocation', 'outsideAvailability'])
  })

  it('works for shifts that run past midnight', () => {
    const s = shift('lin', 1110, 1500) // 18:30 - 01:00 next day
    expect(run({ shifts: [s], avail: [avail('lin', 1000, 1500)], submitted: ['lin'] }).size).toBe(0)
    expect(run({ shifts: [s], avail: [avail('lin', 1000, 1440)], submitted: ['lin'] }).has(s.id)).toBe(true)
  })
})
