import { useSyncExternalStore } from 'react'
import { audioMeta, audioUrl } from './audio'
import type { Item } from './types'

export interface PlayerState {
  itemId: string | null
  title: string
  subtitle: string
  playing: boolean
  loading: boolean
  current: number
  duration: number
  rate: number
  error: string
  queue: string[]
}

const idle: PlayerState = { itemId: null, title: '', subtitle: '', playing: false, loading: false, current: 0, duration: 0, rate: 1, error: '', queue: [] }
let state: PlayerState = { ...idle, rate: readRate() }
const listeners = new Set<() => void>()
const audio = new Audio()
audio.preload = 'metadata'
let lookup: (id: string) => Item | undefined = () => undefined
let subtitleOf: (it: Item) => string = () => ''

function readRate() {
  try {
    return Number(localStorage.getItem('jn:rate')) || 1
  } catch {
    return 1
  }
}
const posKey = (id: string) => `jn:pos:${id}`
function savePos() {
  if (!state.itemId || !audio.duration) return
  try {
    const done = audio.currentTime > audio.duration - 5
    if (done) localStorage.removeItem(posKey(state.itemId))
    else localStorage.setItem(posKey(state.itemId), String(Math.floor(audio.currentTime)))
  } catch {
    /* ignore */
  }
}
function set(patch: Partial<PlayerState>) {
  state = { ...state, ...patch }
  for (const l of listeners) l()
}

export const usePlayer = () =>
  useSyncExternalStore(
    l => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
    () => state,
  )

/** The app tells the player how to resolve items, so it can advance through a queue. */
export function configurePlayer(find: (id: string) => Item | undefined, subtitle: (it: Item) => string) {
  lookup = find
  subtitleOf = subtitle
}

function updateSession() {
  if (!('mediaSession' in navigator) || !state.itemId) return
  navigator.mediaSession.metadata = new MediaMetadata({ title: state.title, artist: state.subtitle, album: 'JustNote Learning', artwork: [{ src: '/icon-512.png', sizes: '512x512', type: 'image/png' }] })
}

export function play(item: Item, queue: string[]) {
  const meta = audioMeta(item)
  if (!meta) return
  if (state.itemId === item.id) {
    void audio.play()
    return
  }
  savePos()
  let start = 0
  try {
    start = Number(localStorage.getItem(posKey(item.id))) || 0
  } catch {
    /* ignore */
  }
  audio.src = audioUrl(meta)
  audio.playbackRate = state.rate
  set({ itemId: item.id, title: item.title, subtitle: subtitleOf(item), playing: false, loading: true, current: start, duration: meta.duration ?? 0, error: '', queue })
  audio.onloadedmetadata = () => {
    if (start > 5 && start < audio.duration - 5) audio.currentTime = start
    set({ duration: Number.isFinite(audio.duration) ? audio.duration : state.duration })
  }
  updateSession()
  void audio.play().catch(() => set({ loading: false, playing: false }))
}

export const toggle = () => (audio.paused ? void audio.play() : audio.pause())
export function seek(t: number) {
  audio.currentTime = Math.max(0, Math.min(t, audio.duration || t))
  set({ current: audio.currentTime })
}
export const skip = (d: number) => seek(audio.currentTime + d)
export function setRate(r: number) {
  audio.playbackRate = r
  try {
    localStorage.setItem('jn:rate', String(r))
  } catch {
    /* ignore */
  }
  set({ rate: r })
}
function step(d: 1 | -1) {
  const i = state.queue.indexOf(state.itemId ?? '')
  const next = state.queue[i + d]
  const it = next ? lookup(next) : undefined
  if (it) play(it, state.queue)
  else if (d === 1) audio.pause()
}
export const next = () => step(1)
export const prev = () => (audio.currentTime > 5 ? seek(0) : step(-1))
export function closePlayer() {
  savePos()
  audio.pause()
  audio.removeAttribute('src')
  audio.load()
  set({ ...idle, rate: state.rate })
}

let lastSave = 0
audio.addEventListener('timeupdate', () => {
  set({ current: audio.currentTime })
  if (Date.now() - lastSave > 3000) {
    lastSave = Date.now()
    savePos()
  }
})
audio.addEventListener('play', () => set({ playing: true, loading: false }))
audio.addEventListener('playing', () => set({ playing: true, loading: false }))
audio.addEventListener('pause', () => {
  savePos()
  set({ playing: false })
})
audio.addEventListener('waiting', () => set({ loading: true }))
audio.addEventListener('canplay', () => set({ loading: false }))
audio.addEventListener('durationchange', () => Number.isFinite(audio.duration) && set({ duration: audio.duration }))
audio.addEventListener('ended', () => step(1))
audio.addEventListener('error', () => state.itemId && set({ loading: false, playing: false, error: '無法播放，請確認網路連線或檔案是否存在' }))
window.addEventListener('pagehide', savePos)

if ('mediaSession' in navigator) {
  const ms = navigator.mediaSession
  const h = (a: MediaSessionAction, f: MediaSessionActionHandler) => {
    try {
      ms.setActionHandler(a, f)
    } catch {
      /* unsupported action */
    }
  }
  h('play', () => void audio.play())
  h('pause', () => audio.pause())
  h('seekbackward', () => skip(-15))
  h('seekforward', () => skip(30))
  h('previoustrack', () => prev())
  h('nexttrack', () => next())
  h('seekto', d => d.seekTime !== undefined && seek(d.seekTime))
}
