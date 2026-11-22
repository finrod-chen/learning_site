import type { SrsCard } from './types'

/** Local calendar day number, so "due today" follows the user's own midnight. */
export const today = (): number => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000)

export type Grade = 'again' | 'good' | 'easy'

/** Simplified SM-2: intervals grow by the card's ease; a lapse resets it. */
export function schedule(prev: SrsCard | undefined, grade: Grade, day = today(), relearnDays = 0): SrsCard {
  const p = prev ?? { due: day, ivl: 0, ease: 2.5, reps: 0, lapses: 0 }
  if (grade === 'again') {
    return { due: day + relearnDays, ivl: relearnDays, ease: Math.max(1.3, p.ease - 0.2), reps: 0, lapses: p.lapses + (p.reps > 0 || prev ? 1 : 0) }
  }
  let ivl: number
  if (p.reps === 0) ivl = grade === 'easy' ? 3 : 1
  else if (p.reps === 1) ivl = grade === 'easy' ? 6 : 3
  else ivl = Math.max(p.ivl + 1, Math.round(p.ivl * p.ease * (grade === 'easy' ? 1.4 : 1)))
  const ease = grade === 'easy' ? p.ease + 0.15 : p.ease
  return { due: day + ivl, ivl, ease, reps: p.reps + 1, lapses: p.lapses }
}

/** Wrong questions graduate once they have been remembered for this many days. */
export const GRADUATE_DAYS = 21

export const dueIn = (c: SrsCard, day = today()) => c.due - day

export function describeDue(c: SrsCard, day = today()): string {
  const d = dueIn(c, day)
  return d <= 0 ? '今天' : d === 1 ? '明天' : `${d} 天後`
}
