import { describe, expect, it } from 'vitest'
import { isTraining, staffing, totalMinutes, trainingMinutes } from './training'

describe('isTraining', () => {
  it('is training when the person has skills but not this position', () => {
    expect(isTraining(new Set(['bar']), 'prep')).toBe(true)
  })
  it('is not training when the person has the skill', () => {
    expect(isTraining(new Set(['bar', 'prep']), 'prep')).toBe(false)
  })
  it('cannot be decided when no skills are set yet, so it is not training', () => {
    expect(isTraining(new Set(), 'prep')).toBe(false)
    expect(isTraining(undefined, 'prep')).toBe(false)
  })
  it('a shift without a position is never training', () => {
    expect(isTraining(new Set(['bar']), null)).toBe(false)
  })
})

describe('staffing and hours', () => {
  const list = [
    { start_min: 540, end_min: 840, training: false }, // 5h
    { start_min: 540, end_min: 720, training: true }, // 3h
    { start_min: 600, end_min: 660, training: false }, // 1h
  ]
  it('counts a trainee as half a person', () => {
    expect(staffing(list)).toBe(2.5)
    expect(staffing([])).toBe(0)
  })
  it('training hours are included in the total and also reported on their own', () => {
    expect(totalMinutes(list)).toBe(9 * 60)
    expect(trainingMinutes(list)).toBe(3 * 60)
  })
})
