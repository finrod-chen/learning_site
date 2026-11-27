import { useState } from 'react'
import { ArrowLeft, FileText, Headphones, Layers, ListChecks, MonitorPlay, Network, Plus, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsPanel, TabsTab } from '@/components/ui/tabs'
import { CourseMenu, ItemMenu } from '@/ui/Menus'
import { EmptyState } from '@/ui/EmptyState'
import { listItems, useDB } from '@/lib/store'
import { countNodes, formatTime, parseFlashcards } from '@/lib/md'
import { parseQuiz } from '@/lib/quiz'
import { go, href } from '@/lib/router'
import { ALL_TYPES, ROUTE_TYPE, TYPE_LABEL, TYPE_ROUTE, type Item, type ItemType } from '@/lib/types'
import { AudioList, UploadDialog } from './Audio'
import { CountdownStrip } from '@/ui/Countdowns'

const ICON = { note: FileText, mindmap: Network, visual: MonitorPlay, flashcards: Layers, quiz: ListChecks, audio: Headphones }
const HINT: Record<ItemType, string> = {
  note: '用 Markdown 寫下重點、整理概念。',
  mindmap: '用標題與清單縮排，自動畫成心智圖。',
  visual: '貼上或載入互動動畫的 HTML，用視覺方式理解概念。',
  flashcards: '每行一張卡：問題 :: 答案。',
  quiz: '貼上考古題：每題 1. 題目、(A)～(D) 選項、答案: C。',
  audio: '上傳 mp3 等音檔，直接在這裡播放。',
}

function meta(it: Item): string {
  if (it.type === 'flashcards') return `${parseFlashcards(it.content).cards.length} 張卡片`
  if (it.type === 'quiz') return `${parseQuiz(it.content).questions.length} 題`
  if (it.type === 'visual') return `${Math.max(1, Math.round(it.content.length / 1024))} KB`
  if (it.type === 'mindmap') return `${countNodes(it.content)} 個節點`
  return `${it.content.replace(/\s/g, '').length} 字`
}

function FileList({ courseId, type, onUpload }: { courseId: string; type: ItemType; onUpload: () => void }) {
  const db = useDB()
  if (type === 'audio') return <AudioList courseId={courseId} onUpload={onUpload} />
  const items = listItems(db, courseId, type)
  if (type === 'quiz') items.sort((a, b) => a.title.localeCompare(b.title, 'zh-Hant', { numeric: true }))
  const Icon = ICON[type]
  if (items.length === 0) {
    return (
      <EmptyState
        title={`還沒有${TYPE_LABEL[type]}`}
        description={HINT[type]}
        action={
          <Button variant="outline" onClick={() => go(`/c/${courseId}/${TYPE_ROUTE[type]}/new`)}>
            新增{TYPE_LABEL[type]}
          </Button>
        }
      />
    )
  }
  return (
    <>
    {type === 'quiz' && (
      <div className="quiz-tools">
        <Button variant="outline" onClick={() => go(`/c/${courseId}/${TYPE_ROUTE.quiz}/mixed`)}>混合測驗</Button>
        <Button variant="outline" onClick={() => go(`/c/${courseId}/${TYPE_ROUTE.quiz}/insights`)}>弱點分析</Button>
      </div>
    )}
    <ul className="file-list">
      {items.map(it => (
        <li key={it.id} className="file-row">
          <a className="file-link" href={href(`/c/${courseId}/${TYPE_ROUTE[type]}/${it.id}`)}>
            <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
            <span className="file-text">
              <span className="file-title">{it.title}</span>
              <span className="file-meta">
                {meta(it)} · {formatTime(it.updatedAt)}
              </span>
            </span>
          </a>
          <ItemMenu item={it} onEdit={() => go(`/c/${courseId}/${TYPE_ROUTE[type]}/${it.id}/edit`)} />
        </li>
      ))}
    </ul>
    </>
  )
}

export function Course({ courseId, section }: { courseId: string; section: string }) {
  const db = useDB()
  const [uploading, setUploading] = useState(false)
  const course = db.courses[courseId]
  if (!course || course.deleted) {
    return (
      <section className="page">
        <EmptyState title="找不到這個課程" description="它可能已被刪除。" action={<Button variant="outline" onClick={() => go('/')}>回到課程列表</Button>} />
      </section>
    )
  }
  const type = ROUTE_TYPE[section] ?? 'note'
  const count = (t: ItemType) => listItems(db, courseId, t).length
  return (
    <section className="page">
      <a className="back" href={href('/')}>
        <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" /> 所有課程
      </a>
      <header className="page-head">
        <h1>{course.name}</h1>
        <div className="head-actions">
          <CourseMenu course={course} onDeleted={() => go('/')} />
        </div>
      </header>

      <CountdownStrip courseId={courseId} />

      <Tabs value={TYPE_ROUTE[type]} onValueChange={v => go(`/c/${courseId}/${v}`)}>
        <div className="tabs-bar">
          <TabsList className="max-w-full overflow-x-auto">
            {ALL_TYPES.map(t => (
              <TabsTab key={t} value={TYPE_ROUTE[t]}>
                {TYPE_LABEL[t]} <span className="count">{count(t)}</span>
              </TabsTab>
            ))}
          </TabsList>
          {type === 'audio' ? (
            <Button onClick={() => setUploading(true)}>
              <Upload size={16} strokeWidth={1.75} aria-hidden="true" /> 上傳有聲書
            </Button>
          ) : (
            <Button onClick={() => go(`/c/${courseId}/${TYPE_ROUTE[type]}/new`)}>
              <Plus size={16} strokeWidth={1.75} aria-hidden="true" /> 新增{TYPE_LABEL[type]}
            </Button>
          )}
        </div>
        {ALL_TYPES.map(t => (
          <TabsPanel key={t} value={TYPE_ROUTE[t]}>
            {t === type && <FileList courseId={courseId} type={t} onUpload={() => setUploading(true)} />}
          </TabsPanel>
        ))}
      </Tabs>
      <UploadDialog open={uploading} courseId={courseId} onClose={() => setUploading(false)} />
    </section>
  )
}
