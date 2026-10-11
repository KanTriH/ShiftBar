import type { Shift } from './types'

/** 培训的人在"人手"里算半个人 */
export const TRAINING_WEIGHT = 0.5

/**
 * 把员工排进某个岗位时，这个班次是不是培训。
 * - 员工一个岗位都没勾过（skills 为空）时无法判断，不算培训，否则功能上线当天所有班次都会变成培训
 * - 没有指定岗位的班次不算培训
 */
export function isTraining(skills: ReadonlySet<string> | undefined, positionId: string | null): boolean {
  return !!positionId && !!skills && skills.size > 0 && !skills.has(positionId)
}

/** 一批班次的人手：正式班次算 1，培训班次算 TRAINING_WEIGHT */
export function staffing(list: Pick<Shift, 'training'>[]): number {
  return list.reduce((n, s) => n + (s.training ? TRAINING_WEIGHT : 1), 0)
}

export const shiftMinutes = (s: Pick<Shift, 'start_min' | 'end_min'>) => s.end_min - s.start_min
export const totalMinutes = (list: Pick<Shift, 'start_min' | 'end_min'>[]) => list.reduce((n, s) => n + shiftMinutes(s), 0)
export const trainingMinutes = (list: Pick<Shift, 'start_min' | 'end_min' | 'training'>[]) => totalMinutes(list.filter((s) => s.training))
