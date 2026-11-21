import { useSyncExternalStore } from 'react'

const sub = (l: () => void) => {
  window.addEventListener('hashchange', l)
  return () => window.removeEventListener('hashchange', l)
}
const snap = () => location.hash.slice(1) || '/'
export const useRoute = () => useSyncExternalStore(sub, snap, () => '/')
export const go = (path: string) => {
  location.hash = path
}
export const href = (path: string) => '#' + path
