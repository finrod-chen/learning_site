import { useState } from 'react'
import { BookOpen, Plus } from 'lucide-react'
import { Button } from '@/components/arc/button/button'
import { PromptDialog } from '@/ui/Dialogs'
import { CourseMenu } from '@/ui/Menus'
import { EmptyState } from '@/ui/EmptyState'
import { createCourse, listCourses, listItems, useDB } from '@/lib/store'
import { formatTime } from '@/lib/md'
import { go, href } from '@/lib/router'
import { toast } from '@/ui/toaster'

export function Home() {
  const db = useDB()
  const courses = listCourses(db)
  const [creating, setCreating] = useState(false)
  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>我的課程</h1>
          <p className="muted">選擇課程開始複習，或建立新的學習主題。</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus size={16} strokeWidth={1.75} aria-hidden="true" /> 新增課程
        </Button>
      </header>

      {courses.length === 0 ? (
        <EmptyState
          title="還沒有課程"
          description="建立第一個課程，把筆記、心智圖和快閃卡放在一起。"
          action={<Button variant="secondary" onClick={() => setCreating(true)}>新增課程</Button>}
        />
      ) : (
        <ul className="course-grid">
          {courses.map(c => {
            const items = listItems(db, c.id)
            const n = (t: string) => items.filter(i => i.type === t).length
            const last = items[0]?.updatedAt ?? c.updatedAt
            return (
              <li key={c.id} className="course-card">
                <a className="course-link" href={href(`/c/${c.id}/notes`)}>
                  <BookOpen size={20} strokeWidth={1.75} aria-hidden="true" />
                  <span className="course-name">{c.name}</span>
                </a>
                <p className="course-meta">
                  筆記 <b>{n('note')}</b> · 心智圖 <b>{n('mindmap')}</b> · 快閃卡 <b>{n('flashcards')}</b>
                </p>
                <div className="course-foot">
                  <span className="muted">更新 {formatTime(last)}</span>
                  <CourseMenu course={c} />
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <PromptDialog
        open={creating}
        title="新增課程"
        description="為這個學習主題取個名字。"
        label="課程名稱"
        confirmLabel="建立課程"
        onSubmit={name => {
          const c = createCourse(name)
          toast('已建立課程', c.name)
          go(`/c/${c.id}/notes`)
        }}
        onClose={() => setCreating(false)}
      />
    </section>
  )
}
