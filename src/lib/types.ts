export type ItemType = 'note' | 'mindmap' | 'flashcards' | 'audio'
export type TextType = Exclude<ItemType, 'audio'>
export const ALL_TYPES: ItemType[] = ['note', 'mindmap', 'flashcards', 'audio']

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

export interface DB {
  courses: Record<string, Course>
  items: Record<string, Item>
}

export const TYPE_LABEL: Record<ItemType, string> = {
  note: '筆記',
  mindmap: '心智圖',
  flashcards: '快閃卡',
  audio: '有聲書',
}

export const TYPE_ROUTE: Record<ItemType, string> = {
  note: 'notes',
  mindmap: 'mindmaps',
  flashcards: 'flashcards',
  audio: 'audiobooks',
}

export const ROUTE_TYPE: Record<string, ItemType> = {
  notes: 'note',
  mindmaps: 'mindmap',
  flashcards: 'flashcards',
  audiobooks: 'audio',
}
