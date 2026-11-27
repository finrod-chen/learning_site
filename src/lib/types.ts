export type ItemType = 'note' | 'mindmap' | 'visual' | 'flashcards' | 'quiz' | 'audio'
export type TextType = Exclude<ItemType, 'audio'>
export const ALL_TYPES: ItemType[] = ['note', 'mindmap', 'visual', 'flashcards', 'quiz', 'audio']

export interface Course {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  deleted?: boolean
}

export interface Item {
  id: string
  courseId: string
  type: ItemType
  title: string
  content: string
  createdAt: number
  updatedAt: number
  deleted?: boolean
}

export interface QuizStat {
  r: number
  w: number
  last: 'r' | 'w'
  t: number
}
export interface QuizAttempt {
  t: number
  mode: 'practice' | 'exam'
  total: number
  correct: number
  secs: number
}
/** Spaced-repetition state of one card or question ("due" is a local day number). */
export interface SrsCard {
  due: number
  ivl: number
  ease: number
  reps: number
  lapses: number
}
export interface QuizProgress {
  stats: Record<string, QuizStat>
  marks: string[]
  history: QuizAttempt[]
  /** wrong questions waiting for review */
  srs?: Record<string, SrsCard>
}
/** Flashcard deck schedule, stored in the doc "srs:<itemId>". */
export interface SrsData {
  cards: Record<string, SrsCard>
  /** how many new cards were introduced on a given day (caps the daily new cards) */
  newToday?: { day: number; count: number }
}
/** A countdown to a named date, stored in the doc "cd:<id>". */
export interface Countdown {
  courseId: string
  name: string
  /** YYYY-MM-DD, local */
  date: string
  deleted?: boolean
}
/**
 * A small synced document (quiz progress, SRS schedule, countdown), last write wins.
 * Ids: "<quizItemId>", "srs:<itemId>", "cd:<id>", "mix:<courseId>".
 */
export interface Progress<T = unknown> {
  id: string
  updatedAt: number
  data: T
}

export interface DB {
  courses: Record<string, Course>
  items: Record<string, Item>
  progress: Record<string, Progress>
}

export const TYPE_LABEL: Record<ItemType, string> = {
  note: '筆記',
  mindmap: '心智圖',
  visual: '視覺學習',
  flashcards: '快閃卡',
  quiz: '題庫',
  audio: '有聲書',
}

export const TYPE_ROUTE: Record<ItemType, string> = {
  note: 'notes',
  mindmap: 'mindmaps',
  visual: 'visuals',
  flashcards: 'flashcards',
  quiz: 'quizzes',
  audio: 'audiobooks',
}

export const ROUTE_TYPE: Record<string, ItemType> = {
  notes: 'note',
  mindmaps: 'mindmap',
  visuals: 'visual',
  flashcards: 'flashcards',
  quizzes: 'quiz',
  audiobooks: 'audio',
}
