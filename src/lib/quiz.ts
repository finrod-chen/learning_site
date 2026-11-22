import { topicOfKey } from './topics'

export interface QuizOption {
  k: string
  text: string
}
export interface QuizQuestion {
  n: number
  key: string
  stem: string
  options: QuizOption[]
  answer: string
  explain: string
  ai: boolean
  /** study topic: a "主題:" line, else the built-in map, else 未分類 */
  topic: string
  /** options that refer to each other ("以上皆是") must keep their order */
  fixedOrder: boolean
}
export interface ParsedQuiz {
  tags: string[]
  questions: QuizQuestion[]
  skipped: number
}

const hash = (s: string) => {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

const Q_START = /^(\d+)(?:\.\s+|[、．]\s*)(.*)$/
const OPT = /^[（(]([A-Ha-h])[)）]\s*(.*)$/
const ANS = /^(?:答案|Answer)\s*[:：]\s*([A-Ha-h])\s*$/
const TOPIC = /^(?:主題|章節|Topic)\s*[:：]\s*(.+)$/i
const EXP = /^解析\s*([(（]AI[)）])?\s*[:：]\s*(.*)$/
const REFERS = /(以上|上述|前述|皆是|皆非|皆可|均可|皆對|皆錯|皆正確|[（(][A-H][)）])/

/**
 * Quiz markdown: "1. stem", options "(A)text", "答案: C", optional "解析: text" (or "解析(AI): text").
 * Lines starting with # before the first question are tags.
 */
export function parseQuiz(md: string): ParsedQuiz {
  const tags: string[] = []
  const questions: QuizQuestion[] = []
  let skipped = 0
  type Draft = { n: number; stem: string; options: QuizOption[]; answer: string; explain: string; ai: boolean; topic: string; state: 'stem' | 'opt' | 'explain' }
  let cur: Draft | null = null

  const finish = () => {
    if (!cur) return
    const stem = cur.stem.trim()
    const keys = cur.options.map(o => o.k)
    if (stem && cur.options.length >= 2 && keys.includes(cur.answer)) {
      questions.push({
        n: cur.n,
        key: hash(stem),
        stem,
        options: cur.options.map(o => ({ k: o.k, text: o.text.trim() })),
        answer: cur.answer,
        explain: cur.explain.trim(),
        ai: cur.ai,
        topic: cur.topic || topicOfKey(hash(stem)),
        fixedOrder: cur.options.some(o => REFERS.test(o.text)),
      })
    } else skipped++
    cur = null
  }

  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trimEnd()
    const t = line.trim()
    if (!cur && /^#\S/.test(t)) {
      tags.push(t)
      continue
    }
    const q = Q_START.exec(t)
    if (q) {
      finish()
      cur = { n: Number(q[1]), stem: q[2], options: [], answer: '', explain: '', ai: false, topic: '', state: 'stem' }
      continue
    }
    if (!cur) continue
    const o = OPT.exec(t)
    if (o && cur.state !== 'explain') {
      cur.options.push({ k: o[1].toUpperCase(), text: o[2] })
      cur.state = 'opt'
      continue
    }
    const a = ANS.exec(t)
    if (a) {
      cur.answer = a[1].toUpperCase()
      continue
    }
    const tp = TOPIC.exec(t)
    if (tp) {
      cur.topic = tp[1].trim()
      continue
    }
    const e = EXP.exec(t)
    if (e) {
      cur.explain = e[2]
      cur.ai = !!e[1]
      cur.state = 'explain'
      continue
    }
    if (cur.state === 'stem') cur.stem += '\n' + line
    else if (cur.state === 'opt' && t) cur.options[cur.options.length - 1].text += ' ' + t
    else if (cur.state === 'explain') cur.explain += '\n' + line
  }
  finish()
  return { tags, questions, skipped }
}

/** Fisher-Yates with a small seeded PRNG so a session keeps its order across re-renders. */
export function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr]
  let s = seed >>> 0 || 1
  const rnd = () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const oneLine = (s: string) => s.replace(/\s*\n\s*/g, ' ').replace(/\|[^\n]*\|/g, '').replace(/\s+/g, ' ').replace(/::/g, ':').trim()

/** Turns wrong answers into flashcards (one card per line: "question :: answer"). */
export function quizToFlashcards(questions: QuizQuestion[], tag: string): string {
  const lines = [`#flashcards/${tag}`]
  for (const q of questions) {
    const opts = q.options.map(o => `(${o.k})${oneLine(o.text)}`).join('　')
    const right = q.options.find(o => o.k === q.answer)
    const back = `(${q.answer})${oneLine(right?.text ?? '')}${q.explain ? '。' + oneLine(q.explain) : ''}`
    lines.push(`${oneLine(q.stem)}　${opts} :: ${back}`)
  }
  return lines.join('\n') + '\n'
}

export function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const m = Math.floor(s / 60)
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
