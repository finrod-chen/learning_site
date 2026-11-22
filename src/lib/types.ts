export type ItemType = 'note' | 'mindmap' | 'flashcards' | 'quiz' | 'audio'
export type TextType = Exclude<ItemType, 'audio'>
export const ALL_TYPES: ItemType[] = ['note', 'mindmap', 'flashcards', 'quiz', 'audio']

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
export interface QuizProgress {
  stats: Record<string, QuizStat>
  marks: string[]
  history: QuizAttempt[]
}
/** Study progress for one quiz item; synced across devices (last write wins). */
export interface Progress {
  id: string
  updatedAt: number
  data: QuizProgress
}

export interface DB {
  courses: Record<string, Course>
  items: Record<string, Item>
  progress: Record<string, Progress>
}

export const TYPE_LABEL: Record<ItemType, string> = {
  note: '筆記',
  mindmap: '心智圖',
  flashcards: '快閃卡',
  quiz: '題庫',
  audio: '有聲書',
}

export const TYPE_ROUTE: Record<ItemType, string> = {
  note: 'notes',
  mindmap: 'mindmaps',
  flashcards: 'flashcards',
  quiz: 'quizzes',
  audio: 'audiobooks',
}

export const ROUTE_TYPE: Record<string, ItemType> = {
  notes: 'note',
  mindmaps: 'mindmap',
  flashcards: 'flashcards',
  quizzes: 'quiz',
  audiobooks: 'audio',
}
