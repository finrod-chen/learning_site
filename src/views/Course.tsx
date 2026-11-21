import { ArrowLeft, FileText, Layers, Network, Plus } from 'lucide-react'
import { Button } from '@/components/arc/button/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/arc/tabs/tabs'
import { CourseMenu, ItemMenu } from '@/ui/Menus'
import { EmptyState } from '@/ui/EmptyState'
import { listItems, useDB } from '@/lib/store'
import { countNodes, formatTime, parseFlashcards } from '@/lib/md'
import { go, href } from '@/lib/router'
import { ROUTE_TYPE, TYPE_LABEL, TYPE_ROUTE, type Item, type ItemType } from '@/lib/types'

const ICON = { note: FileText, mindmap: Network, flashcards: Layers }
const HINT: Record<ItemType, string> = {
  note: '用 Markdown 寫下重點、整理概念。',
  mindmap: '用標題與清單縮排，自動畫成心智圖。',
  flashcards: '每行一張卡：問題 :: 答案。',
}

function meta(it: Item): string {
  if (it.type === 'flashcards') return `${parseFlashcards(it.content).cards.length} 張卡片`
  if (it.type === 'mindmap') return `${countNodes(it.content)} 個節點`
  return `${it.content.replace(/\s/g, '').length} 字`
}

function FileList({ courseId, type }: { courseId: string; type: ItemType }) {
  const db = useDB()
  const items = listItems(db, courseId, type)
  const Icon = ICON[type]
  if (items.length === 0) {
    return (
      <EmptyState
        title={`還沒有${TYPE_LABEL[type]}`}
        description={HINT[type]}
        action={
          <Button variant="secondary" onClick={() => go(`/c/${courseId}/${TYPE_ROUTE[type]}/new`)}>
            新增{TYPE_LABEL[type]}
          </Button>
        }
      />
    )
  }
  return (
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
  )
}

export function Course({ courseId, section }: { courseId: string; section: string }) {
  const db = useDB()
  const course = db.courses[courseId]
  if (!course || course.deleted) {
    return (
      <section className="page">
        <EmptyState title="找不到這個課程" description="它可能已被刪除。" action={<Button variant="secondary" onClick={() => go('/')}>回到課程列表</Button>} />
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

      <Tabs value={TYPE_ROUTE[type]} onValueChange={v => go(`/c/${courseId}/${v}`)}>
        <div className="tabs-bar">
          <TabsList>
            {(['note', 'mindmap', 'flashcards'] as ItemType[]).map(t => (
              <TabsTrigger key={t} value={TYPE_ROUTE[t]}>
                {TYPE_LABEL[t]} <span className="count">{count(t)}</span>
              </TabsTrigger>
            ))}
          </TabsList>
          <Button onClick={() => go(`/c/${courseId}/${TYPE_ROUTE[type]}/new`)}>
            <Plus size={16} strokeWidth={1.75} aria-hidden="true" /> 新增{TYPE_LABEL[type]}
          </Button>
        </div>
        {(['note', 'mindmap', 'flashcards'] as ItemType[]).map(t => (
          <TabsContent key={t} value={TYPE_ROUTE[t]}>
            {t === type && <FileList courseId={courseId} type={t} />}
          </TabsContent>
        ))}
      </Tabs>
    </section>
  )
}
