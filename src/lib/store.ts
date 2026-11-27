import { useSyncExternalStore } from 'react'
import type { Course, DB, Item, ItemType, Progress, QuizProgress } from './types'
import { seedCourse, seedItems, V1_SEED_IDS } from './seed'

const DB_KEY = 'jn:db:v1'
const DIRTY_KEY = 'jn:dirty:v1'
const SEEDED_V1 = 'jn:seeded:v1'
const SEEDED_KEY = 'jn:seeded:v2'
const TOKEN_KEY = 'jn:token'

const empty = (): DB => ({ courses: {}, items: {}, progress: {} })

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage full or blocked: keep working in memory */
  }
}

let db: DB = { ...empty(), ...read<Partial<DB>>(DB_KEY, {}) }
let dirty: Set<string> = new Set(read<string[]>(DIRTY_KEY, []))
const listeners = new Set<() => void>()

/** Adds built-in seed items once per id, so new seeds reach existing users without touching their edits. */
function seedOnce() {
  let applied: string[] = read<string[]>(SEEDED_KEY, [])
  try {
    if (applied.length === 0 && localStorage.getItem(SEEDED_V1) === '1') applied = V1_SEED_IDS
  } catch {
    /* ignore */
  }
  const done = new Set(applied)
  const next: DB = { courses: { ...db.courses }, items: { ...db.items }, progress: { ...db.progress } }
  if (!done.has(seedCourse.id)) {
    if (!next.courses[seedCourse.id]) next.courses[seedCourse.id] = seedCourse
    done.add(seedCourse.id)
  }
  const courseGone = next.courses[seedCourse.id]?.deleted
  for (const it of seedItems) {
    if (done.has(it.id)) {
      // 使用者沒編輯過的內建項目（updatedAt 仍是植入時的值）跟著新版內容更新；編輯或刪除過的保持不動。
      const cur = next.items[it.id]
      if (cur && !cur.deleted && cur.updatedAt === it.updatedAt && (cur.content !== it.content || cur.title !== it.title)) {
        next.items[it.id] = { ...cur, title: it.title, content: it.content }
      }
      continue
    }
    if (!courseGone && !next.items[it.id]) next.items[it.id] = it
    done.add(it.id)
  }
  db = next
  write(DB_KEY, db)
  write(SEEDED_KEY, [...done])
}
seedOnce()

let persistTimer = 0
function persist() {
  window.clearTimeout(persistTimer)
  persistTimer = window.setTimeout(flush, 150)
}
function flush() {
  write(DB_KEY, db)
  write(DIRTY_KEY, [...dirty])
}
window.addEventListener('pagehide', flush)

function emit() {
  for (const l of listeners) l()
}

export function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}
export const getDB = () => db
export const useDB = () => useSyncExternalStore(subscribe, getDB, getDB)

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

const stamp = (prev = 0) => Math.max(Date.now(), prev + 1)

function commit(next: DB, dirtyKeys: string[]) {
  db = next
  for (const k of dirtyKeys) dirty.add(k)
  persist()
  emit()
  scheduleSync()
}

/* ---------- selectors ---------- */
export const listCourses = (d: DB): Course[] =>
  Object.values(d.courses)
    .filter(c => !c.deleted)
    .sort((a, b) => a.createdAt - b.createdAt)

export const listItems = (d: DB, courseId: string, type?: ItemType): Item[] =>
  Object.values(d.items)
    .filter(i => !i.deleted && i.courseId === courseId && (!type || i.type === type))
    .sort((a, b) => b.updatedAt - a.updatedAt || b.createdAt - a.createdAt)

/* ---------- mutations ---------- */
export function createCourse(name: string): Course {
  const now = stamp()
  const c: Course = { id: uid(), name: name.trim() || '未命名課程', createdAt: now, updatedAt: now }
  commit({ ...db, courses: { ...db.courses, [c.id]: c } }, ['c:' + c.id])
  return c
}

export function renameCourse(id: string, name: string) {
  const c = db.courses[id]
  if (!c) return
  commit({ ...db, courses: { ...db.courses, [id]: { ...c, name: name.trim() || c.name, updatedAt: stamp(c.updatedAt) } } }, ['c:' + id])
}

export function deleteCourse(id: string) {
  const c = db.courses[id]
  if (!c) return
  const courses = { ...db.courses, [id]: { ...c, deleted: true, updatedAt: stamp(c.updatedAt) } }
  const items = { ...db.items }
  const keys = ['c:' + id]
  for (const it of Object.values(items)) {
    if (it.courseId === id && !it.deleted) {
      items[it.id] = { ...it, deleted: true, content: '', updatedAt: stamp(it.updatedAt) }
      keys.push('i:' + it.id)
    }
  }
  commit({ ...db, courses, items }, keys)
}

export function createItem(input: { courseId: string; type: ItemType; title: string; content: string }): Item {
  const now = stamp()
  const it: Item = { id: uid(), createdAt: now, updatedAt: now, ...input, title: input.title.trim() || '未命名' }
  commit({ ...db, items: { ...db.items, [it.id]: it } }, ['i:' + it.id])
  return it
}

export function updateItem(id: string, patch: Partial<Pick<Item, 'title' | 'content'>>) {
  const it = db.items[id]
  if (!it) return
  const next = { ...it, ...patch, updatedAt: stamp(it.updatedAt) }
  if (patch.title !== undefined) next.title = patch.title.trim() || it.title
  commit({ ...db, items: { ...db.items, [id]: next } }, ['i:' + id])
}

export function deleteItem(id: string) {
  const it = db.items[id]
  if (!it) return
  commit({ ...db, items: { ...db.items, [id]: { ...it, deleted: true, content: '', updatedAt: stamp(it.updatedAt) } } }, ['i:' + id])
}

/* ---------- small synced documents (quiz progress, SRS, countdowns) ---------- */
export const getDoc = <T>(d: DB, id: string): T | undefined => d.progress[id]?.data as T | undefined

export function putDoc<T>(id: string, fn: (prev: T | undefined) => T) {
  const cur = db.progress[id]
  const rec: Progress = { id, updatedAt: stamp(cur?.updatedAt), data: fn(cur?.data as T | undefined) }
  commit({ ...db, progress: { ...db.progress, [id]: rec } }, ['p:' + id])
}

export const emptyProgress = (): QuizProgress => ({ stats: {}, marks: [], history: [] })
export const getProgress = (d: DB, quizId: string): QuizProgress => getDoc<QuizProgress>(d, quizId) ?? emptyProgress()
export const updateProgress = (quizId: string, fn: (p: QuizProgress) => QuizProgress) => putDoc<QuizProgress>(quizId, prev => fn(prev ?? emptyProgress()))

/* ---------- sync with Workers KV ---------- */
export type SyncState = 'idle' | 'syncing' | 'synced' | 'offline' | 'error' | 'auth' | 'login'
export interface SyncInfo {
  state: SyncState
  at: number
}
let syncInfo: SyncInfo = { state: 'idle', at: 0 }
const syncListeners = new Set<() => void>()
const setSync = (state: SyncState, at = syncInfo.at) => {
  syncInfo = { state, at }
  for (const l of syncListeners) l()
}
export const useSync = () =>
  useSyncExternalStore(
    l => {
      syncListeners.add(l)
      return () => syncListeners.delete(l)
    },
    () => syncInfo,
    () => syncInfo,
  )

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? ''
  } catch {
    return ''
  }
}
export function setToken(token: string) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
  void syncNow()
}

let syncTimer = 0
let syncing = false
let again = false
function scheduleSync() {
  window.clearTimeout(syncTimer)
  syncTimer = window.setTimeout(() => void syncNow(), 1200)
}

interface Remote {
  courses: Course[]
  items: Item[]
  progress?: Progress[]
}

export async function syncNow(): Promise<void> {
  if (syncing) {
    again = true
    return
  }
  if (!navigator.onLine) return setSync('offline')
  syncing = true
  setSync('syncing')
  const sent = new Map<string, number>()
  const courses: Course[] = []
  const items: Item[] = []
  const progress: Progress[] = []
  for (const k of dirty) {
    const id = k.slice(2)
    if (k[0] === 'c' && db.courses[id]) (courses.push(db.courses[id]), sent.set(k, db.courses[id].updatedAt))
    else if (k[0] === 'i' && db.items[id]) (items.push(db.items[id]), sent.set(k, db.items[id].updatedAt))
    else if (k[0] === 'p' && db.progress[id]) (progress.push(db.progress[id]), sent.set(k, db.progress[id].updatedAt))
    else dirty.delete(k)
  }
  try {
    const headers: Record<string, string> = { 'content-type': 'application/json' }
    const token = getToken()
    if (token) headers['x-sync-token'] = token
    const payload = JSON.stringify({ courses, items, progress })
    // keepalive lets a final push survive the tab closing (the browser caps it at 64 KB)
    const res = await fetch('/api/sync', { method: 'POST', headers, body: payload, keepalive: payload.length < 60000, redirect: 'manual' })
    // Cloudflare Access answers an expired session with a redirect to its login page
    if (res.type === 'opaqueredirect') {
      setSync('login')
      return
    }
    if (res.status === 401) {
      setSync('auth')
      return
    }
    if (!res.ok) throw new Error(String(res.status))
    const remote = (await res.json()) as Remote
    const next: DB = { courses: { ...db.courses }, items: { ...db.items }, progress: { ...db.progress } }
    for (const r of remote.progress ?? []) {
      const cur = next.progress[r.id]
      if (!cur || r.updatedAt > cur.updatedAt) next.progress[r.id] = r
    }
    for (const r of remote.courses) {
      const cur = next.courses[r.id]
      if (!cur || r.updatedAt > cur.updatedAt) next.courses[r.id] = r
    }
    for (const r of remote.items) {
      const cur = next.items[r.id]
      if (!cur || r.updatedAt > cur.updatedAt) next.items[r.id] = r
    }
    for (const [k, ts] of sent) {
      const cur = k[0] === 'c' ? next.courses[k.slice(2)] : k[0] === 'p' ? next.progress[k.slice(2)] : next.items[k.slice(2)]
      if (cur && cur.updatedAt === ts) dirty.delete(k)
    }
    db = next
    persist()
    emit()
    setSync('synced', Date.now())
  } catch {
    setSync(navigator.onLine ? 'error' : 'offline')
  } finally {
    syncing = false
    if (again) {
      again = false
      scheduleSync()
    }
  }
}

window.addEventListener('online', () => void syncNow())
window.addEventListener('offline', () => setSync('offline'))
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' || dirty.size > 0) void syncNow()
})
window.addEventListener('pagehide', () => {
  flush()
  if (dirty.size > 0) void syncNow()
})
window.setTimeout(() => void syncNow(), 300)
