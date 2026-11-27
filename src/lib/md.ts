import { Marked } from 'marked'
import DOMPurify from 'dompurify'

const marked = new Marked({ gfm: true, breaks: false })

export function renderMarkdown(md: string): string {
  return DOMPurify.sanitize(marked.parse(md, { async: false }) as string, { ADD_ATTR: ['target'] })
}
export function renderInline(md: string): string {
  return DOMPurify.sanitize(marked.parseInline(md, { async: false }) as string)
}

export interface Card {
  q: string
  a: string
}
export interface ParsedDeck {
  tags: string[]
  cards: Card[]
  skipped: number
}

/** Flashcards: one card per line, "question :: answer". Lines starting with # are tags. */
export function parseFlashcards(md: string): ParsedDeck {
  const tags: string[] = []
  const cards: Card[] = []
  let skipped = 0
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    if (/^#\S/.test(line)) {
      tags.push(line)
      continue
    }
    const idx = line.indexOf('::')
    if (idx > 0 && line.slice(idx + 2).trim()) {
      cards.push({ q: line.slice(0, idx).trim(), a: line.slice(idx + 2).trim() })
    } else {
      skipped++
    }
  }
  return { tags, cards, skipped }
}

export function cardKey(c: Card): string {
  let h = 5381
  const s = c.q + '\u0001' + c.a
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

export function countNodes(md: string): number {
  return md.split(/\r?\n/).filter(l => /^\s*(#{1,6}\s|[-*+]\s)/.test(l)).length
}

export function download(filename: string, text: string, ext: '.md' | '.html' = '.md') {
  const url = URL.createObjectURL(new Blob([text], { type: ext === '.html' ? 'text/html;charset=utf-8' : 'text/markdown;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith(ext) ? filename : filename + ext
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function formatTime(ts: number): string {
  if (ts <= 1000) return '預設內容'
  const d = new Date(ts)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  return sameDay
    ? d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })
    : d.toLocaleDateString('zh-TW', { year: 'numeric', month: 'numeric', day: 'numeric' })
}
