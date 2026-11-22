import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/ui/Dialogs'
import { EmptyState } from '@/ui/EmptyState'
import { toast } from '@/ui/toaster'
import { countNodes, parseFlashcards, renderInline } from '@/lib/md'
import { parseQuiz } from '@/lib/quiz'
import { createItem, updateItem, useDB } from '@/lib/store'
import { go } from '@/lib/router'
import { TYPE_LABEL, TYPE_ROUTE, type TextType as ItemType } from '@/lib/types'
import { MindmapCanvas, Note } from './Viewers'
import { Loading, Segmented, SplitButton, TextField } from '@/ui/kit'

const PLACEHOLDER: Record<ItemType, string> = {
  note: '# 標題\n\n用 Markdown 寫筆記。\n\n- 重點一\n- 重點二',
  mindmap: '# 主題\n## 分支一\n- 重點 A\n  - 細節\n## 分支二\n- 重點 B',
  flashcards: '#flashcards/標籤\n問題一 :: 答案一\n問題二 :: 答案二',
  quiz: '#quiz/標籤\n1. 題目內容\n(A)選項一\n(B)選項二\n(C)選項三\n(D)選項四\n答案: C\n解析: 這裡寫解析（可留空）',
}

const TEXT_TYPES: ItemType[] = ['note', 'mindmap', 'flashcards', 'quiz']

function Preview({ as, md }: { as: ItemType; md: string }) {
  const deck = useMemo(() => (as === 'flashcards' ? parseFlashcards(md) : null), [as, md])
  const quiz = useMemo(() => (as === 'quiz' ? parseQuiz(md) : null), [as, md])
  if (!md.trim()) {
    return <EmptyState title="預覽會顯示在這裡" description={`${TYPE_LABEL[as]}格式範例：\n${PLACEHOLDER[as]}`} />
  }
  if (as === 'note') return <Note md={md} />
  if (as === 'mindmap')
    return (
      <div className="mm-canvas mm-small">
        <Suspense fallback={<Loading label="載入心智圖" lines={5} />}>
          <MindmapCanvas md={md} level={0} />
        </Suspense>
      </div>
    )
  if (as === 'quiz' && quiz)
    return (
      <div className="fc-preview">
        <div className="fc-top">
          {quiz.tags.map(t => (
            <Badge key={t} variant="info" size="sm">{t.replace(/^#/, '')}</Badge>
          ))}
          <span className="muted">{quiz.questions.length} 題{quiz.skipped ? `，${quiz.skipped} 題格式不完整已略過` : ''}</span>
        </div>
        <ul className="fc-list">
          {quiz.questions.slice(0, 100).map(q => (
            <li key={q.key} className="fc-item">
              <div className="fc-q">{q.n}. {q.stem.split('\n')[0]}</div>
              <div className="fc-a">答案：({q.answer}) {q.options.find(o => o.k === q.answer)?.text}</div>
            </li>
          ))}
        </ul>
      </div>
    )
  return (
    <div className="fc-preview">
      <div className="fc-top">
        {deck!.tags.map(t => (
          <Badge key={t} variant="info" size="sm">{t.replace(/^#/, '')}</Badge>
        ))}
        <span className="muted">{deck!.cards.length} 張卡片{deck!.skipped ? `，${deck!.skipped} 行未使用（缺少 ::）` : ''}</span>
      </div>
      <ul className="fc-list">
        {deck!.cards.slice(0, 200).map((c, i) => (
          <li key={i} className="fc-item">
            <div className="fc-q" dangerouslySetInnerHTML={{ __html: renderInline(c.q) }} />
            <div className="fc-a" dangerouslySetInnerHTML={{ __html: renderInline(c.a) }} />
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Editor({ courseId, type, itemId }: { courseId: string; type: ItemType; itemId?: string }) {
  const db = useDB()
  const existing = itemId ? db.items[itemId] : undefined
  const course = db.courses[courseId]
  const base = existing ?? { title: '', content: '' }
  const [title, setTitle] = useState(base.title)
  const [content, setContent] = useState(base.content)
  const [previewAs, setPreviewAs] = useState<ItemType>((existing?.type ?? type) as ItemType)
  const [pane, setPane] = useState<'edit' | 'preview'>('edit')
  const [error, setError] = useState('')
  const [leave, setLeave] = useState(false)
  const saved = useRef(false)
  const area = useRef<HTMLTextAreaElement>(null)

  const home = (existing ? existing.type : type) as ItemType
  const dirty = !saved.current && (title !== base.title || content !== base.content)

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  function save(target: ItemType) {
    if (!title.trim()) return setError('請先替這份內容取個名稱。')
    if (target === 'flashcards' && parseFlashcards(content).cards.length === 0) return setError('快閃卡至少需要一行「問題 :: 答案」。')
    if (target === 'quiz' && parseQuiz(content).questions.length === 0) return setError('題庫至少需要一題：1. 題目、(A)(B) 選項與「答案: X」。')
    if (target === 'mindmap' && countNodes(content) === 0) return setError('心智圖至少需要一個標題（#）或清單項目（-）。')
    setError('')
    saved.current = true
    if (existing && target === existing.type) {
      updateItem(existing.id, { title, content })
      toast('已儲存')
      go(`/c/${courseId}/${TYPE_ROUTE[target]}/${existing.id}`)
    } else {
      const it = createItem({ courseId, type: target, title, content })
      toast(existing ? `已另存為${TYPE_LABEL[target]}` : '已儲存', it.title)
      go(`/c/${courseId}/${TYPE_ROUTE[target]}/${it.id}`)
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        save(home)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!course || course.deleted || (itemId && (!existing || existing.deleted))) {
    return (
      <section className="page">
        <EmptyState title="找不到要編輯的內容" description="它可能已被刪除。" action={<Button variant="outline" onClick={() => go('/')}>回到課程列表</Button>} />
      </section>
    )
  }

  const backPath = existing ? `/c/${courseId}/${TYPE_ROUTE[existing.type]}/${existing.id}` : `/c/${courseId}/${TYPE_ROUTE[type]}`
  const others = TEXT_TYPES.filter(t => t !== home)

  return (
    <section className="page editor">
      <button type="button" className="back back-btn" onClick={() => (dirty ? setLeave(true) : go(backPath))}>
        <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" /> {existing ? '返回' : `${course.name} / ${TYPE_LABEL[type]}`}
      </button>
      <header className="page-head">
        <h1>{existing ? `編輯${TYPE_LABEL[existing.type]}` : `新增${TYPE_LABEL[type]}`}</h1>
        <SplitButton
          label="儲存"
          onClick={() => save(home)}
          actions={others.map(t => ({ label: `${existing ? '另存為' : '存為'}${TYPE_LABEL[t]}`, onSelect: () => save(t) }))}
        />
      </header>

      <TextField label="名稱" value={title} onChange={e => setTitle(e.target.value)} maxLength={120} placeholder="例如：第一章重點整理" error={error && !title.trim() ? error : undefined} />
      {error && title.trim() && <p className="form-error" role="alert">{error}</p>}

      <div className="editor-bar">
        <div className="pane-toggle">
          <Segmented label="編輯或預覽" value={pane} onValueChange={v => setPane(v as 'edit' | 'preview')} options={[{ value: 'edit', label: '編輯' }, { value: 'preview', label: '預覽' }]} />
        </div>
        <Segmented
          label="預覽方式"
          value={previewAs}
          onValueChange={v => setPreviewAs(v as ItemType)}
          options={TEXT_TYPES.map(t => ({ value: t, label: TYPE_LABEL[t] }))}
        />
      </div>

      <div className="editor-grid" data-pane={pane}>
        <div className="editor-pane">
          <label className="sr-only" htmlFor="md-input">Markdown 內容</label>
          <textarea
            id="md-input"
            ref={area}
            className="md-input"
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder={PLACEHOLDER[home]}
            spellCheck={false}
          />
        </div>
        <div className="editor-pane preview-pane">
          <Preview as={previewAs} md={content} />
        </div>
      </div>
      <p className="muted">在「儲存」旁的箭頭，可以把同一份內容存成筆記、心智圖或快閃卡。快捷鍵 Ctrl/⌘ + S 儲存。</p>

      <ConfirmDialog
        open={leave}
        title="放棄未儲存的變更？"
        description="離開後，這次的修改不會保留。"
        confirmLabel="放棄變更"
        onConfirm={() => {
          saved.current = true
          go(backPath)
        }}
        onClose={() => setLeave(false)}
      />
    </section>
  )
}
