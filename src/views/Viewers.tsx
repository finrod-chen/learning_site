import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Maximize2, RotateCcw, Shuffle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ItemMenu } from '@/ui/Menus'
import { EmptyState } from '@/ui/EmptyState'
import { cardKey, formatTime, parseFlashcards, renderInline, renderMarkdown, type Card } from '@/lib/md'
import { getDoc, putDoc, useDB } from '@/lib/store'
import { describeDue, schedule, today, type Grade } from '@/lib/srs'
import { reviewSets, type KeyedCard } from '@/lib/review'
import { go, href } from '@/lib/router'
import { TYPE_LABEL, TYPE_ROUTE, type Item, type SrsData } from '@/lib/types'
import type { MindmapHandle } from './MindmapCanvas'
import { QuizView } from './Quiz'
import { VisualView } from './Visual'
import { Loading, Prog, Segmented, TextField } from '@/ui/kit'

export const MindmapCanvas = lazy(() => import('./MindmapCanvas'))

export function Note({ md }: { md: string }) {
  const html = useMemo(() => renderMarkdown(md), [md])
  if (!md.trim()) return <EmptyState title="這份筆記是空的" description="按「編輯」開始寫。" />
  return <article className="prose" dangerouslySetInnerHTML={{ __html: html }} />
}

export function Mindmap({ md }: { md: string }) {
  const [level, setLevel] = useState(2)
  const handle = useRef<MindmapHandle | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const onReady = useCallback((h: MindmapHandle) => {
    handle.current = h
  }, [])
  const full = () => {
    const el = box.current
    if (!el) return
    if (document.fullscreenElement) void document.exitFullscreen()
    else void el.requestFullscreen?.().catch(() => undefined)
  }
  return (
    <div className="mm-wrap" ref={box}>
      <div className="mm-bar">
        <Segmented
          label="展開層級"
          value={String(level)}
          onValueChange={v => setLevel(Number(v))}
          options={[
            { value: '1', label: '1 層' },
            { value: '2', label: '2 層' },
            { value: '3', label: '3 層' },
            { value: '0', label: '全部' },
          ]}
        />
        <div className="mm-tools">
          <Button variant="outline" size="sm" onClick={() => handle.current?.fit()}>適配畫面</Button>
          <Button variant="outline" size="sm" onClick={full}>
            <Maximize2 size={14} strokeWidth={1.75} aria-hidden="true" /> 全螢幕
          </Button>
        </div>
      </div>
      <div className="mm-canvas">
        <Suspense fallback={<Loading label="載入心智圖" lines={6} />}>
          <MindmapCanvas md={md} level={level} onReady={onReady} />
        </Suspense>
      </div>
      <p className="muted mm-hint">拖曳移動，滾輪或雙指縮放，點節點圓點展開或收合。</p>
    </div>
  )
}

/* ---------------- flashcards ---------------- */
function useKnown(itemId: string) {
  const key = `jn:fc:${itemId}`
  const [known, setKnown] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(key) ?? '[]') as string[])
    } catch {
      return new Set()
    }
  })
  const update = (fn: (s: Set<string>) => void) =>
    setKnown(prev => {
      const next = new Set(prev)
      fn(next)
      try {
        localStorage.setItem(key, JSON.stringify([...next]))
      } catch {
        /* ignore */
      }
      return next
    })
  return [known, update] as const
}

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/* ---------------- spaced-repetition review ---------------- */
function FlashReview({ itemId, cards }: { itemId: string; cards: KeyedCard[] }) {
  const db = useDB()
  const doc = getDoc<SrsData>(db, 'srs:' + itemId)
  const day = today()
  const [queue, setQueue] = useState<string[]>(() => {
    const { due, fresh } = reviewSets(cards, doc, day)
    return [...due, ...fresh].map(c => c.k)
  })
  const [flipped, setFlipped] = useState(false)
  const [done, setDone] = useState(0)
  const byKey = useMemo(() => new Map(cards.map(c => [c.k, c])), [cards])
  const k = queue[0]
  const cur = k ? byKey.get(k) : undefined

  const grade = useCallback(
    (g: Grade) => {
      if (!k) return
      putDoc<SrsData>('srs:' + itemId, prev => {
        const d: SrsData = prev ?? { cards: {} }
        const had = d.cards[k]
        const intro = d.newToday?.day === day ? d.newToday.count : 0
        return { ...d, cards: { ...d.cards, [k]: schedule(had, g, day) }, newToday: had ? d.newToday : { day, count: intro + 1 } }
      })
      setQueue(q => (g === 'again' ? [...q.slice(1), k] : q.slice(1)))
      if (g !== 'again') setDone(n => n + 1)
      setFlipped(false)
    },
    [k, itemId, day],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /INPUT|TEXTAREA/.test(e.target.tagName)) return
      if (e.key === ' ' || e.key === 'Enter') {
        if (e.target instanceof HTMLElement && e.target.closest('button,a')) return
        e.preventDefault()
        setFlipped(f => !f)
      } else if (flipped && e.key === '1') grade('again')
      else if (flipped && e.key === '2') grade('good')
      else if (flipped && e.key === '3') grade('easy')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [flipped, grade])

  if (!cur) {
    const later = Object.values(doc?.cards ?? {}).filter(c => c.due > day)
    const tomorrow = later.filter(c => c.due === day + 1).length
    return (
      <EmptyState
        title={done > 0 ? `今天的複習完成，共 ${done} 張` : '今天沒有需要複習的卡片'}
        description={later.length ? `明天到期 ${tomorrow} 張，之後還有 ${later.length - tomorrow} 張排在後面。` : '先在「學習」模式看過卡片，再回來複習，系統會依記憶狀況安排下次出現的時間。'}
      />
    )
  }
  const srs = doc?.cards[cur.k]
  const hint = (g: Grade) => describeDue(schedule(srs, g, day))
  return (
    <>
      <Prog value={done} max={done + queue.length} label={`剩餘 ${queue.length} 張，已完成 ${done}`} />
      <div className="fc-stage">
        <button type="button" className="fc-card" data-flipped={flipped} aria-label={flipped ? '顯示問題' : '顯示答案'} aria-pressed={flipped} onClick={() => setFlipped(f => !f)}>
          <span className="fc-face fc-front">
            <span className="fc-side">問題{srs ? '' : '（新卡片）'}</span>
            <span className="fc-text" dangerouslySetInnerHTML={{ __html: renderInline(cur.q) }} />
            <span className="fc-tip">想一想，再點一下翻面</span>
          </span>
          <span className="fc-face fc-back">
            <span className="fc-side">答案</span>
            <span className="fc-text" dangerouslySetInnerHTML={{ __html: renderInline(cur.a) }} />
          </span>
        </button>
      </div>
      {flipped ? (
        <div className="fc-grades">
          <Button variant="outline" onClick={() => grade('again')}>還不熟<small>{hint('again')}</small></Button>
          <Button variant="outline" onClick={() => grade('good')}>記得了<small>{hint('good')}</small></Button>
          <Button onClick={() => grade('easy')}>很熟<small>{hint('easy')}</small></Button>
        </div>
      ) : (
        <p className="muted fc-keys">先回想答案，再翻面對照，然後誠實評分。快捷鍵：空白鍵翻面，1 還不熟，2 記得了，3 很熟</p>
      )}
    </>
  )
}

export function Flashcards({ item, review }: { item: Item; review?: boolean }) {
  const db = useDB()
  const deck = useMemo(() => parseFlashcards(item.content), [item.content])
  const [known, update] = useKnown(item.id)
  const [view, setView] = useState<'study' | 'review' | 'list'>(review ? 'review' : 'study')
  const [only, setOnly] = useState<'all' | 'unknown'>('all')
  const [shuffle, setShuffle] = useState(false)
  const [seed, setSeed] = useState(0)
  const [i, setI] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [q, setQ] = useState('')

  const keyed = useMemo(() => deck.cards.map(c => ({ ...c, k: cardKey(c) })), [deck.cards])
  const queue = useMemo(() => {
    const base = only === 'unknown' ? keyed.filter(c => !known.has(c.k)) : keyed
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    seed
    return shuffle ? shuffled(base) : base
    // known intentionally excluded so a card stays put right after it is marked
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyed, only, shuffle, seed])

  const cur = queue[Math.min(i, queue.length - 1)]
  const knownCount = keyed.filter(c => known.has(c.k)).length
  const rs = reviewSets(keyed, getDoc<SrsData>(db, 'srs:' + item.id))
  const reviewN = rs.due.length + rs.fresh.length

  const move = useCallback(
    (d: number) => {
      if (queue.length === 0) return
      setFlipped(false)
      setI(p => (p + d + queue.length) % queue.length)
    },
    [queue.length],
  )
  const mark = useCallback(
    (ok: boolean) => {
      if (!cur) return
      update(s => (ok ? s.add(cur.k) : s.delete(cur.k)))
      move(1)
    },
    [cur, move],
  )

  useEffect(() => {
    if (view !== 'study') return
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /INPUT|TEXTAREA/.test(e.target.tagName)) return
      if (e.key === ' ' || e.key === 'Enter') {
        if (e.target instanceof HTMLElement && e.target.closest('button,a')) return
        e.preventDefault()
        setFlipped(f => !f)
      } else if (e.key === 'ArrowRight') move(1)
      else if (e.key === 'ArrowLeft') move(-1)
      else if (e.key === '1') mark(false)
      else if (e.key === '2') mark(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view, move, mark])

  const touch = useRef<number | null>(null)

  if (keyed.length === 0) {
    return <EmptyState title="這份快閃卡沒有卡片" description="每行寫一張卡：問題 :: 答案。按「編輯」補上內容。" />
  }

  const list = keyed.filter(c => !q || (c.q + c.a).toLowerCase().includes(q.toLowerCase()))

  return (
    <div className="fc">
      <div className="fc-top">
        <Segmented
          label="模式"
          value={view}
          onValueChange={v => setView(v as 'study' | 'review' | 'list')}
          options={[
            { value: 'study', label: '學習' },
            { value: 'review', label: `複習 ${reviewN}` },
            { value: 'list', label: `全部 ${keyed.length}` },
          ]}
        />
        {deck.tags.map(t => (
          <Badge key={t} variant="info" size="sm">{t.replace(/^#/, '')}</Badge>
        ))}
      </div>

      {view === 'review' ? (
        <FlashReview itemId={item.id} cards={keyed} />
      ) : view === 'study' ? (
        <>
          <Prog value={knownCount} max={keyed.length} label={`已記得 ${knownCount} / ${keyed.length}`} />
          <div className="fc-opts">
            <Segmented
              label="範圍"
              value={only}
              onValueChange={v => {
                setOnly(v as 'all' | 'unknown')
                setI(0)
                setFlipped(false)
              }}
              options={[
                { value: 'all', label: '全部卡片' },
                { value: 'unknown', label: '只複習不熟的' },
              ]}
            />
            <Button
              variant="outline"
              size="sm"
              aria-pressed={shuffle}
              onClick={() => {
                setShuffle(s => !s)
                setSeed(s => s + 1)
                setI(0)
                setFlipped(false)
              }}
            >
              {shuffle ? <Check size={14} strokeWidth={1.75} aria-hidden="true" /> : <Shuffle size={14} strokeWidth={1.75} aria-hidden="true" />} 隨機{shuffle ? '：開' : ''}
            </Button>
          </div>

          {!cur ? (
            <EmptyState
              title="這一輪都記得了"
              description="不熟的卡片已經清空。可以回到全部卡片再複習一次。"
              action={
                <Button
                  variant="outline"
                  onClick={() => {
                    setOnly('all')
                    setI(0)
                  }}
                >
                  <RotateCcw size={14} strokeWidth={1.75} aria-hidden="true" /> 回到全部卡片
                </Button>
              }
            />
          ) : (
            <>
              <div
                className="fc-stage"
                onTouchStart={e => (touch.current = e.touches[0].clientX)}
                onTouchEnd={e => {
                  if (touch.current == null) return
                  const dx = e.changedTouches[0].clientX - touch.current
                  touch.current = null
                  if (Math.abs(dx) > 60) move(dx < 0 ? 1 : -1)
                }}
              >
                <button type="button" className="fc-card" data-flipped={flipped} aria-label={flipped ? '顯示問題' : '顯示答案'} aria-pressed={flipped} onClick={() => setFlipped(f => !f)}>
                  <span className="fc-face fc-front">
                    <span className="fc-side">問題</span>
                    <span className="fc-text" dangerouslySetInnerHTML={{ __html: renderInline(cur.q) }} />
                    <span className="fc-tip">點一下翻面</span>
                  </span>
                  <span className="fc-face fc-back">
                    <span className="fc-side">答案</span>
                    <span className="fc-text" dangerouslySetInnerHTML={{ __html: renderInline(cur.a) }} />
                    {known.has(cur.k) && <Badge variant="success" size="sm"><Check aria-hidden="true" />已記得</Badge>}
                  </span>
                </button>
              </div>
              <div className="fc-nav">
                <Button variant="ghost" aria-label="上一張" onClick={() => move(-1)}><ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true" /></Button>
                <span className="fc-count">{Math.min(i, queue.length - 1) + 1} / {queue.length}</span>
                <Button variant="ghost" aria-label="下一張" onClick={() => move(1)}><ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" /></Button>
              </div>
              <div className="fc-judge">
                <Button variant="outline" onClick={() => mark(false)}>還不熟</Button>
                <Button onClick={() => mark(true)}>記得了</Button>
              </div>
              <p className="muted fc-keys">快捷鍵：空白鍵翻面，左右鍵切換，1 還不熟，2 記得了</p>
            </>
          )}
        </>
      ) : (
        <>
          <TextField label="搜尋卡片" value={q} onChange={e => setQ(e.target.value)} placeholder="輸入關鍵字" />
          <ul className="fc-list">
            {list.map((c: Card & { k: string }) => (
              <li key={c.k} className="fc-item">
                <div className="fc-q" dangerouslySetInnerHTML={{ __html: renderInline(c.q) }} />
                <div className="fc-a" dangerouslySetInnerHTML={{ __html: renderInline(c.a) }} />
                <Button variant="ghost" size="sm" aria-pressed={known.has(c.k)} onClick={() => update(s => (s.has(c.k) ? s.delete(c.k) : s.add(c.k)))}>
                  {known.has(c.k) ? '已記得' : '標為記得'}
                </Button>
              </li>
            ))}
            {list.length === 0 && <li className="muted">沒有符合的卡片。</li>}
          </ul>
        </>
      )}
    </div>
  )
}

/* ---------------- item page ---------------- */
export function ItemView({ courseId, itemId, review }: { courseId: string; itemId: string; review?: boolean }) {
  const db = useDB()
  const item = db.items[itemId]
  const course = db.courses[courseId]
  if (!item || item.deleted || !course || course.deleted) {
    return (
      <section className="page">
        <EmptyState title="找不到這個檔案" description="它可能已被刪除。" action={<Button variant="outline" onClick={() => go(`/c/${courseId}`)}>回到課程</Button>} />
      </section>
    )
  }
  const section = TYPE_ROUTE[item.type]
  const back = `/c/${courseId}/${section}`
  return (
    <section className="page">
      <a className="back" href={href(back)}>
        <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" /> {course.name} / {TYPE_LABEL[item.type]}
      </a>
      <header className="page-head">
        <div>
          <h1>{item.title}</h1>
          <p className="muted">更新 {formatTime(item.updatedAt)}</p>
        </div>
        <div className="head-actions">
          <Button variant="outline" onClick={() => go(`${back}/${item.id}/edit`)}>編輯</Button>
          <ItemMenu item={item} onEdit={() => go(`${back}/${item.id}/edit`)} onDeleted={() => go(back)} />
        </div>
      </header>
      {item.type === 'note' && <Note md={item.content} />}
      {item.type === 'mindmap' && <Mindmap md={item.content} />}
      {item.type === 'flashcards' && <Flashcards item={item} review={review} />}
      {item.type === 'quiz' && <QuizView item={item} review={review} />}
      {item.type === 'visual' && <VisualView item={item} />}
    </section>
  )
}
