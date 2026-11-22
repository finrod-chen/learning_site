import { getDoc, putDoc } from './store'
import type { Countdown, DB } from './types'

export interface CountdownRow extends Countdown {
  id: string
  days: number
}

/** Whole days from today (local) to a YYYY-MM-DD date; negative once it has passed. */
export function daysUntil(date: string, now = new Date()): number {
  const [y, m, d] = date.split('-').map(Number)
  const target = new Date(y, (m ?? 1) - 1, d ?? 1)
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((target.getTime() - start.getTime()) / 86400000)
}

export function listCountdowns(db: DB, courseId?: string): CountdownRow[] {
  const rows: CountdownRow[] = []
  for (const [id, rec] of Object.entries(db.progress)) {
    if (!id.startsWith('cd:')) continue
    const c = rec.data as Countdown
    if (!c || c.deleted || !c.date || (courseId && c.courseId !== courseId)) continue
    rows.push({ ...c, id, days: daysUntil(c.date) })
  }
  // upcoming first (nearest on top), then past ones with the most recent first
  return rows.sort((a, b) => (a.days >= 0 ? 0 : 1) - (b.days >= 0 ? 0 : 1) || (a.days >= 0 ? a.days - b.days : b.days - a.days))
}

export function saveCountdown(input: { id?: string; courseId: string; name: string; date: string }) {
  const id = input.id ?? 'cd:' + crypto.randomUUID()
  putDoc<Countdown>(id, () => ({ courseId: input.courseId, name: input.name.trim() || '倒數', date: input.date }))
  return id
}

export function removeCountdown(id: string) {
  putDoc<Countdown>(id, prev => ({ ...(prev as Countdown), deleted: true }))
}

export const getCountdown = (db: DB, id: string) => getDoc<Countdown>(db, id)

export function describeDays(days: number): { big: string; unit: string; text: string } {
  if (days === 0) return { big: '今天', unit: '', text: '就是今天' }
  if (days > 0) return { big: String(days), unit: '天', text: `還有 ${days} 天` }
  return { big: String(-days), unit: '天前', text: `已過 ${-days} 天` }
}

export function formatDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.toLocaleDateString('zh-TW', { year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short' })
}
