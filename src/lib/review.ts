import { cardKey, parseFlashcards, type Card } from './md'
import { parseQuiz } from './quiz'
import { getDoc, getProgress, listCourses, listItems } from './store'
import { today } from './srs'
import type { DB, SrsData } from './types'
import { TYPE_ROUTE } from './types'

/** New flashcards introduced per day, so a big deck does not bury you on day one. */
export const NEW_PER_DAY = 10

export type KeyedCard = Card & { k: string }

export const keyCards = (cards: Card[]): KeyedCard[] => cards.map(c => ({ ...c, k: cardKey(c) }))

/** Cards due today (oldest first) plus today's allowance of new cards. */
export function reviewSets(cards: KeyedCard[], doc: SrsData | undefined, day = today()) {
  const srs = doc?.cards ?? {}
  const due = cards.filter(c => srs[c.k] && srs[c.k].due <= day).sort((a, b) => srs[a.k].due - srs[b.k].due)
  const introduced = doc?.newToday?.day === day ? doc.newToday.count : 0
  const fresh = cards.filter(c => !srs[c.k]).slice(0, Math.max(0, NEW_PER_DAY - introduced))
  return { due, fresh }
}

export interface ReviewRow {
  courseId: string
  courseName: string
  itemId: string
  title: string
  kind: 'flashcards' | 'quiz'
  due: number
  fresh: number
  path: string
}

/** Everything that is waiting for review today, across all courses. */
export function todaySummary(db: DB, day = today()): ReviewRow[] {
  const rows: ReviewRow[] = []
  for (const c of listCourses(db)) {
    for (const it of listItems(db, c.id)) {
      if (it.type === 'flashcards') {
        const { due, fresh } = reviewSets(keyCards(parseFlashcards(it.content).cards), getDoc<SrsData>(db, 'srs:' + it.id), day)
        if (due.length + fresh.length > 0) rows.push({ courseId: c.id, courseName: c.name, itemId: it.id, title: it.title, kind: 'flashcards', due: due.length, fresh: fresh.length, path: `/c/${c.id}/${TYPE_ROUTE.flashcards}/${it.id}/review` })
      } else if (it.type === 'quiz') {
        const p = getProgress(db, it.id)
        const due = parseQuiz(it.content).questions.filter(q => p.srs?.[q.key] && p.srs[q.key].due <= day).length
        if (due > 0) rows.push({ courseId: c.id, courseName: c.name, itemId: it.id, title: it.title, kind: 'quiz', due, fresh: 0, path: `/c/${c.id}/${TYPE_ROUTE.quiz}/${it.id}/review` })
      }
    }
  }
  return rows
}
