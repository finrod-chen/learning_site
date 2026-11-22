import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Bookmark, BookmarkCheck, Check, ChevronLeft, ChevronRight, Clock, Layers, RotateCcw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/ui/Dialogs'
import { EmptyState } from '@/ui/EmptyState'
import { toast } from '@/ui/toaster'
import { formatClock, parseQuiz, quizToFlashcards, seededShuffle, type QuizQuestion } from '@/lib/quiz'
import { renderInline, renderMarkdown } from '@/lib/md'
import { createItem, emptyProgress, getProgress, updateProgress, useDB } from '@/lib/store'
import { GRADUATE_DAYS, schedule, today } from '@/lib/srs'
import { go } from '@/lib/router'
import { TYPE_ROUTE, type DB, type Item, type QuizProgress } from '@/lib/types'
import { LabeledSwitch, Prog, Segmented } from '@/ui/kit'

type Mode = 'practice' | 'exam'
/** A question together with the quiz item it came from (progress is kept per quiz). */
export type SQ = QuizQuestion & { src: string }
export interface Session {
  id: number
  mode: Mode
  questions: SQ[]
  shuffleOpts: boolean
  limitSec: number
}
interface Outcome {
  mode: Mode
  questions: SQ[]
  picked: Record<string, string>
  secs: number
}
/** Where results are recorded and where wrong answers turn into flashcards. */
export interface QuizCtx {
  historyId: string
  courseId: string
  title: string
}
export type Scope = 'all' | 'wrong' | 'due' | 'marked' | 'fresh'

/** Records one answer: stats, and the wrong-answer review schedule. */
export function applyAnswer(prev: QuizProgress, key: string, ok: boolean, day = today()): QuizProgress {
  const s = prev.stats[key] ?? { r: 0, w: 0, last: 'r' as const, t: 0 }
  const stats = { ...prev.stats, [key]: { r: s.r + (ok ? 1 : 0), w: s.w + (ok ? 0 : 1), last: ok ? ('r' as const) : ('w' as const), t: Date.now() } }
  const srs = { ...(prev.srs ?? {}) }
  const cur = srs[key]
  if (!ok) srs[key] = schedule(cur, 'again', day, 1)
  else if (cur && cur.due <= day) {
    const n = schedule(cur, 'good', day)
    if (n.ivl >= GRADUATE_DAYS) delete srs[key]
    else srs[key] = n
  }
  return { ...prev, stats, srs }
}

export const isDue = (p: QuizProgress, key: string, day = today()) => !!p.srs?.[key] && p.srs[key].due <= day

/** Filters questions by study scope, reading each question's own quiz progress. */
export function inScope(qs: SQ[], db: DB, scope: Scope): SQ[] {
  return qs.filter(q => {
    const p = getProgress(db, q.src)
    if (scope === 'all') return true
    if (scope === 'wrong') return p.stats[q.key]?.last === 'w'
    if (scope === 'due') return isDue(p, q.key)
    if (scope === 'marked') return p.marks.includes(q.key)
    return !p.stats[q.key]
  })
}

const LETTERS = 'ABCDEFGH'
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)

function Stem({ q }: { q: QuizQuestion }) {
  const html = useMemo(() => renderMarkdown(q.stem), [q.stem])
  return <div className="prose qstem" dangerouslySetInnerHTML={{ __html: html }} />
}

function Explain({ q }: { q: QuizQuestion }) {
  if (!q.explain) return null
  return (
    <div className="explain">
      {q.ai && <Badge variant="info" size="sm">AI 草稿</Badge>}
      <p dangerouslySetInnerHTML={{ __html: renderInline(q.explain).replace(/\n/g, '<br>') }} />
    </div>
  )
}

/* ------------------------------ runner ------------------------------ */
function Runner({ ctx, session, onFinish, onExit }: { ctx: QuizCtx; session: Session; onFinish: (o: Outcome) => void; onExit: () => void }) {
  const db = useDB()
  const { questions, mode } = session
  const [idx, setIdx] = useState(0)
  const [picked, setPicked] = useState<Record<string, string>>({})
  const [confirm, setConfirm] = useState<'submit' | 'exit' | null>(null)
  const startedAt = useRef(Date.now())
  const [now, setNow] = useState(Date.now())
  const done = useRef(false)

  const q = questions[idx]
  const shown = useMemo(
    () => questions.map((x, i) => (session.shuffleOpts && !x.fixedOrder ? seededShuffle(x.options, session.id + i * 7919) : x.options)),
    [questions, session],
  )
  const opts = shown[idx]
  const markedIn = (x: SQ) => getProgress(db, x.src).marks.includes(x.key)
  const isMarked = markedIn(q)
  const revealed = mode === 'practice' && picked[q.key] !== undefined
  const answered = questions.filter(x => picked[x.key] !== undefined).length
  const elapsed = Math.floor((now - startedAt.current) / 1000)
  const remaining = session.limitSec ? session.limitSec - elapsed : null

  const finish = useCallback(
    (p: Record<string, string>) => {
      if (done.current) return
      done.current = true
      const secs = Math.floor((Date.now() - startedAt.current) / 1000)
      const correct = questions.filter(x => p[x.key] === x.answer).length
      if (mode === 'exam') {
        const bySrc = new Map<string, SQ[]>()
        for (const x of questions) if (p[x.key] !== undefined) bySrc.set(x.src, [...(bySrc.get(x.src) ?? []), x])
        for (const [src, xs] of bySrc) updateProgress(src, prev => xs.reduce((acc, x) => applyAnswer(acc, x.key, p[x.key] === x.answer), prev))
      }
      updateProgress(ctx.historyId, prev => ({ ...prev, history: [...prev.history, { t: Date.now(), mode, total: questions.length, correct, secs }].slice(-30) }))
      onFinish({ mode, questions, picked: p, secs })
    },
    [ctx.historyId, mode, onFinish, questions],
  )

  useEffect(() => {
    if (mode !== 'exam' || !session.limitSec) return
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [mode, session.limitSec])
  useEffect(() => {
    if (remaining !== null && remaining <= 0) finish(picked)
  }, [remaining, finish, picked])

  const pick = useCallback(
    (k: string) => {
      if (revealed) return
      const ok = k === q.answer
      setPicked(p => ({ ...p, [q.key]: k }))
      if (mode === 'practice') updateProgress(q.src, prev => applyAnswer(prev, q.key, ok))
    },
    [revealed, q, mode],
  )
  const toggleMark = useCallback(
    () => updateProgress(q.src, prev => ({ ...prev, marks: prev.marks.includes(q.key) ? prev.marks.filter(m => m !== q.key) : [...prev.marks, q.key] })),
    [q.src, q.key],
  )
  const last = idx === questions.length - 1
  const next = useCallback(() => {
    if (mode === 'practice' && !revealed) return
    if (last) {
      if (mode === 'practice') finish(picked)
      else setConfirm('submit')
    } else setIdx(i => i + 1)
  }, [mode, revealed, last, finish, picked])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (confirm || (e.target instanceof HTMLElement && /INPUT|TEXTAREA/.test(e.target.tagName))) return
      const n = e.key >= '1' && e.key <= '9' ? Number(e.key) - 1 : 'abcdefgh'.indexOf(e.key.toLowerCase())
      if (e.key.length === 1 && n >= 0 && n < opts.length) pick(opts[n].k)
      else if (e.key === 'Enter' || e.key === 'ArrowRight') {
        if (e.target instanceof HTMLElement && e.target.closest('button') && e.key === 'Enter') return
        next()
      } else if (e.key === 'ArrowLeft') setIdx(i => Math.max(0, i - 1))
      else if (e.key.toLowerCase() === 'm') toggleMark()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirm, opts, pick, next, toggleMark])

  const stateOf = (k: string): 'idle' | 'picked' | 'right' | 'wrong' | 'dim' => {
    const p = picked[q.key]
    if (mode === 'exam') return p === k ? 'picked' : 'idle'
    if (p === undefined) return 'idle'
    if (k === q.answer) return 'right'
    return p === k ? 'wrong' : 'dim'
  }

  return (
    <div className="quiz-run">
      <div className="quiz-top">
        <Button variant="ghost" size="sm" onClick={() => (answered > 0 ? setConfirm('exit') : onExit())}>
          <ChevronLeft size={16} strokeWidth={1.75} aria-hidden="true" /> 結束
        </Button>
        <span className="quiz-count">第 {idx + 1} / {questions.length} 題</span>
        {remaining !== null && (
          <span className="quiz-timer" role="timer" aria-label="剩餘時間" data-low={remaining < 300 || undefined}>
            <Clock size={14} strokeWidth={1.75} aria-hidden="true" /> {formatClock(remaining)}
          </span>
        )}
        <Button variant="ghost" size="sm" aria-pressed={isMarked} onClick={toggleMark}>
          {isMarked ? <BookmarkCheck size={16} strokeWidth={1.75} aria-hidden="true" /> : <Bookmark size={16} strokeWidth={1.75} aria-hidden="true" />} 標記
        </Button>
      </div>
      <Prog value={idx + (revealed ? 1 : 0)} max={questions.length} label={mode === 'exam' ? `已作答 ${answered} / ${questions.length}` : '進度'} />

      <Stem q={q} />
      <div className="qopts" role="group" aria-label="選項">
        {opts.map((o, i) => {
          const st = stateOf(o.k)
          return (
            <button key={o.k} type="button" className="qopt" data-state={st} aria-pressed={st === 'picked'} disabled={revealed} onClick={() => pick(o.k)}>
              <span className="qletter">{LETTERS[i]}</span>
              <span className="qtext" dangerouslySetInnerHTML={{ __html: renderInline(o.text) }} />
              {st === 'right' && <span className="qmark"><Check size={16} strokeWidth={2} aria-hidden="true" /> 正確答案</span>}
              {st === 'wrong' && <span className="qmark"><X size={16} strokeWidth={2} aria-hidden="true" /> 你的答案</span>}
            </button>
          )
        })}
      </div>

      {revealed && <Explain q={q} />}

      {mode === 'exam' && (
        <div className="qgrid" role="group" aria-label="題號">
          {questions.map((x, i) => (
            <button key={x.key} type="button" className="qnum" data-current={i === idx || undefined} data-done={picked[x.key] !== undefined || undefined} data-marked={markedIn(x) || undefined} aria-label={`第 ${i + 1} 題${picked[x.key] !== undefined ? '，已作答' : ''}${markedIn(x) ? '，已標記' : ''}`} onClick={() => setIdx(i)}>
              {i + 1}
            </button>
          ))}
        </div>
      )}

      <div className="quiz-nav">
        <Button variant="outline" disabled={idx === 0} onClick={() => setIdx(i => i - 1)}>
          <ChevronLeft size={16} strokeWidth={1.75} aria-hidden="true" /> 上一題
        </Button>
        {mode === 'exam' && <Button variant="outline" onClick={() => setConfirm('submit')}>交卷</Button>}
        <Button disabled={mode === 'practice' && !revealed} onClick={next}>
          {last ? (mode === 'practice' ? '查看結果' : '交卷') : '下一題'} {!last && <ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" />}
        </Button>
      </div>

      <ConfirmDialog
        open={confirm === 'submit'}
        title="要交卷嗎？"
        description={answered < questions.length ? `還有 ${questions.length - answered} 題沒有作答，交卷後未作答的題目以答錯計算。` : '交卷後會顯示成績與錯題。'}
        confirmLabel="交卷"
        danger={false}
        onConfirm={() => finish(picked)}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'exit'}
        title="要結束這次作答嗎？"
        description={mode === 'exam' ? '模擬考尚未交卷，結束後這次的作答不會計分。' : '已作答的題目已記錄在錯題本與統計中，可隨時再回來練習。'}
        confirmLabel="結束作答"
        onConfirm={onExit}
        onClose={() => setConfirm(null)}
      />
    </div>
  )
}

/* ------------------------------ result ------------------------------ */
function Result({ ctx, outcome, onRetry, onHome }: { ctx: QuizCtx; outcome: Outcome; onRetry: (qs: SQ[]) => void; onHome: () => void }) {
  const { questions, picked, secs, mode } = outcome
  const correct = questions.filter(q => picked[q.key] === q.answer).length
  const wrong = questions.filter(q => picked[q.key] !== q.answer)
  const score = pct(correct, questions.length)
  const toCards = () => {
    const tag = '題庫錯題'
    const card = createItem({ courseId: ctx.courseId, type: 'flashcards', title: `${ctx.title}・錯題`, content: quizToFlashcards(wrong, tag) })
    toast('已轉成快閃卡', `${wrong.length} 張`)
    go(`/c/${ctx.courseId}/${TYPE_ROUTE.flashcards}/${card.id}`)
  }
  return (
    <div className="quiz-result">
      <div className="score">
        <span className="score-num">{score}<small>分</small></span>
        <span className="muted">答對 {correct} / {questions.length} 題，用時 {formatClock(secs)}（{mode === 'exam' ? '模擬考' : '練習'}）</span>
      </div>
      <div className="quiz-actions">
        {wrong.length > 0 && <Button onClick={() => onRetry(wrong)}><RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" /> 重練錯題 {wrong.length}</Button>}
        {wrong.length > 0 && <Button variant="outline" onClick={toCards}><Layers size={16} strokeWidth={1.75} aria-hidden="true" /> 錯題轉快閃卡</Button>}
        <Button variant="outline" onClick={onHome}>返回</Button>
      </div>
      {wrong.length === 0 ? (
        <EmptyState title="全部答對" description="這一輪沒有錯題，繼續保持。" />
      ) : (
        <>
          <h2 className="quiz-h">答錯與未作答的題目</h2>
          <ul className="wrong-list">
            {wrong.map(q => {
              const mine = q.options.find(o => o.k === picked[q.key])
              const right = q.options.find(o => o.k === q.answer)
              return (
                <li key={q.key} className="wrong-item">
                  <Stem q={q} />
                  <p className="wrong-line"><X size={14} strokeWidth={2} aria-hidden="true" /> 你的答案：{mine ? `(${mine.k}) ${mine.text}` : '未作答'}</p>
                  <p className="wrong-line right"><Check size={14} strokeWidth={2} aria-hidden="true" /> 正確答案：({q.answer}) {right?.text}</p>
                  <Explain q={q} />
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}


/* ------------------------------ shared flow ------------------------------ */
/** Runs the practice / exam / result flow; `children` renders the start screen. */
export function QuizSession({ ctx, children }: { ctx: QuizCtx; children: (start: (s: Omit<Session, 'id'>) => void) => ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const start = (s: Omit<Session, 'id'>) => {
    setOutcome(null)
    setSession({ ...s, id: Date.now() })
  }
  if (session) return <Runner key={session.id} ctx={ctx} session={session} onExit={() => setSession(null)} onFinish={o => (setOutcome(o), setSession(null))} />
  if (outcome) return <Result ctx={ctx} outcome={outcome} onHome={() => setOutcome(null)} onRetry={qs => start({ mode: 'practice', questions: qs, shuffleOpts: false, limitSec: 0 })} />
  return <>{children(start)}</>
}

export function HistoryTable({ history }: { history: QuizProgress['history'] }) {
  if (history.length === 0) return null
  return (
    <section className="quiz-card" aria-labelledby="hist-h">
      <h2 id="hist-h" className="quiz-h">最近成績</h2>
      <div className="hist-scroll">
        <table className="hist">
          <thead><tr><th scope="col">日期</th><th scope="col">模式</th><th scope="col">答對</th><th scope="col">成績</th><th scope="col">用時</th></tr></thead>
          <tbody>
            {[...history].reverse().slice(0, 8).map(h => (
              <tr key={h.t}>
                <td>{new Date(h.t).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}</td>
                <td>{h.mode === 'exam' ? '模擬考' : '練習'}</td>
                <td>{h.correct} / {h.total}</td>
                <td>{pct(h.correct, h.total)} 分</td>
                <td>{formatClock(h.secs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/** Practice / mock-exam launcher over a pool of questions (one quiz, or several mixed together). */
export function Launcher({ pool, mixed, onStart }: { pool: SQ[]; mixed?: boolean; onStart: (s: Omit<Session, 'id'>) => void }) {
  const db = useDB()
  const N = pool.length
  const [scope, setScope] = useState<Scope>('all')
  const [shuffleQ, setShuffleQ] = useState(!!mixed)
  const [shuffleO, setShuffleO] = useState(false)
  const [count, setCount] = useState(String(Math.min(N, 50)))
  const [limit, setLimit] = useState('0')
  const by = {
    all: pool,
    wrong: inScope(pool, db, 'wrong'),
    due: inScope(pool, db, 'due'),
    marked: inScope(pool, db, 'marked'),
    fresh: inScope(pool, db, 'fresh'),
  }
  const list = by[scope]
  const counts = [...new Set([Math.min(10, N), Math.min(25, N), Math.min(50, N), N])].filter(c => c > 0)
  const shuffledOr = (qs: SQ[]) => (shuffleQ ? seededShuffle(qs, Date.now()) : qs)
  useEffect(() => {
    if (!counts.includes(Number(count))) setCount(String(counts[counts.length - 1] ?? N))
  }, [N]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <section className="quiz-card" aria-labelledby="practice-h">
        <h2 id="practice-h" className="quiz-h">練習模式</h2>
        <p className="muted">一題一題作答，選完立刻看對錯與解析。</p>
        <Segmented
          label="練習範圍"
          value={scope}
          onValueChange={v => setScope(v as Scope)}
          options={[
            { value: 'all', label: `全部 ${N}` },
            { value: 'wrong', label: `錯題 ${by.wrong.length}` },
            { value: 'due', label: `到期 ${by.due.length}` },
            { value: 'marked', label: `標記 ${by.marked.length}` },
            { value: 'fresh', label: `未答 ${by.fresh.length}` },
          ]}
        />
        <div className="quiz-switches">
          <LabeledSwitch label="隨機題目順序" checked={shuffleQ} onCheckedChange={setShuffleQ} />
          <LabeledSwitch label="隨機選項順序" checked={shuffleO} onCheckedChange={setShuffleO} />
        </div>
        <div className="quiz-actions">
          <Button disabled={list.length === 0} onClick={() => onStart({ mode: 'practice', questions: shuffledOr(list), shuffleOpts: shuffleO, limitSec: 0 })}>
            開始練習 {list.length}
          </Button>
          {list.length === 0 && <span className="muted">這個範圍目前沒有題目。</span>}
        </div>
      </section>

      <section className="quiz-card" aria-labelledby="exam-h">
        <h2 id="exam-h" className="quiz-h">模擬考</h2>
        <p className="muted">作答中不顯示答案，交卷後計分並列出錯題。{mixed ? '題目會從已選的題庫中隨機抽取。' : ''}</p>
        <div className="quiz-row">
          <Segmented label="題數" value={count} onValueChange={setCount} options={counts.map(c => ({ value: String(c), label: c === N ? `全部 ${c} 題` : `${c} 題` }))} />
          <Segmented label="時間" value={limit} onValueChange={setLimit} options={[{ value: '0', label: '不限時' }, { value: '1800', label: '30 分' }, { value: '3600', label: '60 分' }]} />
        </div>
        <div className="quiz-actions">
          <Button
            variant="outline"
            disabled={N === 0}
            onClick={() => {
              const c = Number(count)
              const qs = c < N ? seededShuffle(pool, Date.now()).slice(0, c) : shuffledOr(pool)
              onStart({ mode: 'exam', questions: qs, shuffleOpts: shuffleO, limitSec: Number(limit) })
            }}
          >
            開始模擬考
          </Button>
        </div>
      </section>
    </>
  )
}

/* ------------------------------ home ------------------------------ */
function Home({ item, questions, progress, onStart, initialDue }: { item: Item; questions: SQ[]; progress: QuizProgress; onStart: (s: Omit<Session, 'id'>) => void; initialDue?: boolean }) {
  const db = useDB()
  const N = questions.length
  const [reset, setReset] = useState(false)
  const stats = progress.stats
  const wrong = questions.filter(q => stats[q.key]?.last === 'w')
  const marked = questions.filter(q => progress.marks.includes(q.key))
  const due = inScope(questions, db, 'due')
  const answered = questions.filter(q => stats[q.key]).length
  const right = questions.reduce((a, q) => a + (stats[q.key]?.r ?? 0), 0)
  const total = questions.reduce((a, q) => a + (stats[q.key]?.r ?? 0) + (stats[q.key]?.w ?? 0), 0)

  return (
    <div className="quiz-home">
      <dl className="stats">
        <div><dt>題數</dt><dd>{N}</dd></div>
        <div><dt>已作答</dt><dd>{answered}</dd></div>
        <div><dt>累計正確率</dt><dd>{total ? `${pct(right, total)}%` : '--'}</dd></div>
        <div><dt>錯題</dt><dd>{wrong.length}</dd></div>
      </dl>

      {due.length > 0 && (
        <section className="quiz-card due-card" aria-labelledby="due-h" data-focus={initialDue || undefined}>
          <h2 id="due-h" className="quiz-h">今天該複習 {due.length} 題</h2>
          <p className="muted">這些是之前答錯、依間隔重複排程今天到期的題目。答對後下次間隔會拉長，連續記得就會畢業。</p>
          <div className="quiz-actions">
            <Button onClick={() => onStart({ mode: 'practice', questions: due, shuffleOpts: false, limitSec: 0 })}>複習到期題 {due.length}</Button>
          </div>
        </section>
      )}

      <Launcher pool={questions} onStart={onStart} />
      <HistoryTable history={progress.history} />

      {(answered > 0 || progress.history.length > 0 || marked.length > 0) && (
        <div><Button variant="ghost" size="sm" onClick={() => setReset(true)}>清除作答紀錄</Button></div>
      )}
      <ConfirmDialog
        open={reset}
        title="清除這份題庫的作答紀錄？"
        description="錯題本、到期排程、標記與歷次成績都會被清除，題目本身不受影響。"
        confirmLabel="清除紀錄"
        onConfirm={() => {
          updateProgress(item.id, () => emptyProgress())
          toast('已清除作答紀錄')
        }}
        onClose={() => setReset(false)}
      />
    </div>
  )
}

/* ------------------------------ entry ------------------------------ */
export function QuizView({ item, review }: { item: Item; review?: boolean }) {
  const db = useDB()
  const parsed = useMemo(() => parseQuiz(item.content), [item.content])
  const questions = useMemo<SQ[]>(() => parsed.questions.map(q => ({ ...q, src: item.id })), [parsed, item.id])
  const progress = getProgress(db, item.id)
  const ctx: QuizCtx = { historyId: item.id, courseId: item.courseId, title: item.title }
  if (questions.length === 0) {
    return <EmptyState title="這份題庫沒有可用的題目" description={'格式：\n1. 題目\n(A)選項\n(B)選項\n答案: A\n解析: （可留空）\n按「編輯」補上內容。'} />
  }
  return (
    <QuizSession ctx={ctx}>
      {start => (
        <>
          {parsed.skipped > 0 && <p className="form-error" role="alert">有 {parsed.skipped} 題格式不完整，已略過。</p>}
          <Home item={item} questions={questions} progress={progress} onStart={start} initialDue={review} />
        </>
      )}
    </QuizSession>
  )
}
