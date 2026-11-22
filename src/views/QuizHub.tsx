import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/ui/EmptyState'
import { HistoryTable, Launcher, QuizSession, inScope, type QuizCtx, type SQ } from './Quiz'
import { parseQuiz } from '@/lib/quiz'
import { TOPICS, TOPIC_SUBJECT, UNCLASSIFIED } from '@/lib/topics'
import { getDoc, getProgress, listItems, useDB } from '@/lib/store'
import { href, go } from '@/lib/router'
import { TYPE_ROUTE, type DB, type Item, type QuizProgress } from '@/lib/types'
import { LabeledSwitch, Prog } from '@/ui/kit'

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)

/** Every quiz of a course with its parsed questions, kept stable between renders. */
function useCourseQuizzes(courseId: string) {
  const db = useDB()
  const items = listItems(db, courseId, 'quiz').sort((a, b) => a.title.localeCompare(b.title, 'zh-Hant', { numeric: true }))
  const sig = items.map(i => `${i.id}:${i.updatedAt}`).join('|')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const parsed = useMemo(() => items.map(it => ({ it, qs: parseQuiz(it.content).questions.map(q => ({ ...q, src: it.id }) as SQ) })), [sig])
  return { db, course: db.courses[courseId], parsed }
}

function Shell({ courseId, title, lead, children }: { courseId: string; title: string; lead: string; children: React.ReactNode }) {
  return (
    <section className="page">
      <a className="back" href={href(`/c/${courseId}/${TYPE_ROUTE.quiz}`)}>
        <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" /> 題庫
      </a>
      <header className="page-head">
        <div>
          <h1>{title}</h1>
          <p className="muted">{lead}</p>
        </div>
      </header>
      {children}
    </section>
  )
}

function NoQuiz({ courseId }: { courseId: string }) {
  return <EmptyState title="這個課程還沒有題庫" description="先新增或匯入題庫，才能使用這個功能。" action={<Button variant="outline" onClick={() => go(`/c/${courseId}/${TYPE_ROUTE.quiz}`)}>回到題庫</Button>} />
}

/* ---------------------------- mixed quiz ---------------------------- */
export function MixedQuizPage({ courseId }: { courseId: string }) {
  const { db, course, parsed } = useCourseQuizzes(courseId)
  const [off, setOff] = useState<Record<string, boolean>>({})
  if (!course || course.deleted) return <section className="page"><NoQuiz courseId={courseId} /></section>
  const chosen = parsed.filter(p => !off[p.it.id])
  const pool = chosen.flatMap(p => p.qs)
  const subjects = [...new Set(parsed.map(p => /第[一二三四五六]科/.exec(p.it.title)?.[0]).filter((x): x is string => !!x))]
  const ctx: QuizCtx = { historyId: `mix:${courseId}`, courseId, title: '混合測驗' }
  const history = getDoc<QuizProgress>(db, ctx.historyId)?.history ?? []

  return (
    <Shell courseId={courseId} title="混合測驗" lead="把多份題庫的題目混在一起練習或模擬考，更接近真正的考試。">
      {parsed.length === 0 ? (
        <NoQuiz courseId={courseId} />
      ) : (
        <QuizSession ctx={ctx}>
          {start => (
            <div className="quiz-home">
              <section className="quiz-card" aria-labelledby="src-h">
                <h2 id="src-h" className="quiz-h">題庫來源　<span className="muted">共 {pool.length} 題</span></h2>
                <div className="quiz-actions">
                  <Button variant="outline" size="sm" onClick={() => setOff({})}>全選</Button>
                  {subjects.map(s => (
                    <Button key={s} variant="outline" size="sm" onClick={() => setOff(Object.fromEntries(parsed.filter(p => !p.it.title.includes(s)).map(p => [p.it.id, true])))}>
                      只選{s}
                    </Button>
                  ))}
                </div>
                <ul className="src-list">
                  {parsed.map(p => (
                    <li key={p.it.id}>
                      <LabeledSwitch label={`${p.it.title}（${p.qs.length} 題）`} checked={!off[p.it.id]} onCheckedChange={c => setOff(o => ({ ...o, [p.it.id]: !c }))} />
                    </li>
                  ))}
                </ul>
              </section>
              <Launcher pool={pool} mixed onStart={start} />
              <HistoryTable history={history} />
            </div>
          )}
        </QuizSession>
      )}
    </Shell>
  )
}

/* ---------------------------- weakness report ---------------------------- */
interface TopicRow {
  topic: string
  qs: SQ[]
  attempted: number
  right: number
  total: number
  wrong: SQ[]
  due: number
}

function analyze(pool: SQ[], db: DB): TopicRow[] {
  const by = new Map<string, SQ[]>()
  for (const q of pool) by.set(q.topic, [...(by.get(q.topic) ?? []), q])
  const rows: TopicRow[] = []
  for (const [topic, qs] of by) {
    let attempted = 0, right = 0, total = 0, due = 0
    const wrong: SQ[] = []
    for (const q of qs) {
      const p = getProgress(db, q.src)
      const s = p.stats[q.key]
      if (s) {
        attempted++
        right += s.r
        total += s.r + s.w
        if (s.last === 'w') wrong.push(q)
      }
      if (p.srs?.[q.key] && p.srs[q.key].due <= Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000)) due++
    }
    rows.push({ topic, qs, attempted, right, total, wrong, due })
  }
  const order = (t: string) => (TOPICS.indexOf(t) === -1 ? 99 : TOPICS.indexOf(t))
  return rows.sort((a, b) => {
    const wa = a.total ? a.right / a.total : 2
    const wb = b.total ? b.right / b.total : 2
    return wa - wb || order(a.topic) - order(b.topic)
  })
}

export function InsightsPage({ courseId }: { courseId: string }) {
  const { db, course, parsed } = useCourseQuizzes(courseId)
  const pool = useMemo(() => parsed.flatMap(p => p.qs), [parsed])
  const rows = analyze(pool, db)
  const ctx: QuizCtx = { historyId: `mix:${courseId}`, courseId, title: '弱點練習' }
  const attempted = rows.reduce((a, r) => a + r.attempted, 0)
  const right = rows.reduce((a, r) => a + r.right, 0)
  const total = rows.reduce((a, r) => a + r.total, 0)
  const weak = rows.filter(r => r.total > 0 && r.right / r.total < 0.8).slice(0, 3)
  if (!course || course.deleted) return <section className="page"><NoQuiz courseId={courseId} /></section>

  return (
    <Shell courseId={courseId} title="弱點分析" lead="依主題統計你的正確率，找出最該回頭複習的章節。">
      {pool.length === 0 ? (
        <NoQuiz courseId={courseId} />
      ) : (
        <QuizSession ctx={ctx}>
          {start => (
            <div className="quiz-home">
              <dl className="stats">
                <div><dt>題目總數</dt><dd>{pool.length}</dd></div>
                <div><dt>已作答</dt><dd>{attempted}</dd></div>
                <div><dt>累計正確率</dt><dd>{total ? `${pct(right, total)}%` : '--'}</dd></div>
                <div><dt>目前錯題</dt><dd>{rows.reduce((a, r) => a + r.wrong.length, 0)}</dd></div>
              </dl>

              <section className="quiz-card" aria-labelledby="weak-h">
                <h2 id="weak-h" className="quiz-h">優先加強</h2>
                {weak.length === 0 ? (
                  <p className="muted">{total === 0 ? '還沒有作答紀錄。先練習幾題，這裡就會列出最需要加強的主題。' : '目前每個已練習的主題正確率都在 80% 以上，繼續保持。'}</p>
                ) : (
                  <ol className="weak-list">
                    {weak.map(r => (
                      <li key={r.topic}>
                        <span>{r.topic}</span>
                        <span className="muted">{pct(r.right, r.total)}%，錯題 {r.wrong.length}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </section>

              <section className="quiz-card" aria-labelledby="topic-h">
                <h2 id="topic-h" className="quiz-h">各主題表現</h2>
                <ul className="topic-list">
                  {rows.map(r => {
                    const acc = r.total ? pct(r.right, r.total) : 0
                    const isWeak = weak.includes(r)
                    return (
                      <li key={r.topic} className="topic-row">
                        <div className="topic-head">
                          <span className="topic-name">{r.topic}</span>
                          {TOPIC_SUBJECT[r.topic] && <Badge variant="secondary" size="sm">{TOPIC_SUBJECT[r.topic]}</Badge>}
                          {isWeak && <Badge variant="warning" size="sm">優先加強</Badge>}
                          {r.topic === UNCLASSIFIED && <Badge variant="secondary" size="sm">未分類</Badge>}
                        </div>
                        <Prog value={acc} max={100} label={r.total ? `正確率 ${acc}%` : '尚未練習'} />
                        <p className="muted topic-meta">
                          已練習 {r.attempted} / {r.qs.length} 題 · 錯題 {r.wrong.length}
                          {r.due > 0 ? ` · 今天到期 ${r.due}` : ''}
                        </p>
                        <div className="quiz-actions">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const rank = (q: SQ) => (inScope([q], db, 'wrong').length ? 0 : inScope([q], db, 'fresh').length ? 1 : 2)
                              start({ mode: 'practice', questions: [...r.qs].sort((a, b) => rank(a) - rank(b)), shuffleOpts: false, limitSec: 0 })
                            }}
                          >
                            練習此主題 {r.qs.length}
                          </Button>
                          {r.wrong.length > 0 && (
                            <Button variant="ghost" size="sm" onClick={() => start({ mode: 'practice', questions: r.wrong, shuffleOpts: false, limitSec: 0 })}>
                              只練錯題 {r.wrong.length}
                            </Button>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>
            </div>
          )}
        </QuizSession>
      )}
    </Shell>
  )
}

export type { Item }
