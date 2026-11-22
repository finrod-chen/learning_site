import { useState } from 'react'
import { Download, Pencil, SquarePen, Trash2 } from 'lucide-react'
import { audioDownloadUrl, audioMeta, deleteAudioFile } from '@/lib/audio'
import { ActionMenu } from './kit'
import { ConfirmDialog, PromptDialog } from './Dialogs'
import { deleteCourse, deleteItem, renameCourse, updateItem } from '@/lib/store'
import { download } from '@/lib/md'
import type { Course, Item } from '@/lib/types'
import { TYPE_LABEL } from '@/lib/types'
import { toast } from './toaster'

const ic = { size: 16, strokeWidth: 1.75 }

function downloadAudio(item: Item) {
  const meta = audioMeta(item)
  if (!meta) return
  const a = document.createElement('a')
  a.href = audioDownloadUrl(meta, `${item.title}.${meta.key.split('.').pop()}`)
  a.rel = 'noopener'
  document.body.append(a)
  a.click()
  a.remove()
}

export function ItemMenu({ item, onEdit, onDeleted }: { item: Item; onEdit: () => void; onDeleted?: () => void }) {
  const [dlg, setDlg] = useState<'rename' | 'delete' | null>(null)
  return (
    <>
      <ActionMenu
        label="更多"
        items={[
          ...(item.type === 'audio' ? [] : [{ label: '編輯內容', icon: <SquarePen {...ic} />, onSelect: onEdit }]),
          { label: '更名', icon: <Pencil {...ic} />, onSelect: () => setDlg('rename') },
          item.type === 'audio'
            ? { label: '下載音檔', icon: <Download {...ic} />, onSelect: () => downloadAudio(item) }
            : { label: '匯出 Markdown', icon: <Download {...ic} />, onSelect: () => download(item.title, item.content) },
          { label: '刪除', icon: <Trash2 {...ic} />, destructive: true, separatorBefore: true, onSelect: () => setDlg('delete') },
        ]}
      />
      <PromptDialog
        open={dlg === 'rename'}
        title={`更名${TYPE_LABEL[item.type]}`}
        label="名稱"
        initial={item.title}
        confirmLabel="儲存名稱"
        onSubmit={v => {
          updateItem(item.id, { title: v })
          toast('已更名')
        }}
        onClose={() => setDlg(null)}
      />
      <ConfirmDialog
        open={dlg === 'delete'}
        title={`刪除「${item.title}」？`}
        description={`這份${TYPE_LABEL[item.type]}會被永久刪除，無法復原。`}
        confirmLabel="刪除"
        onConfirm={() => {
          const meta = item.type === 'audio' ? audioMeta(item) : null
          deleteItem(item.id)
          if (meta) deleteAudioFile(meta)
          toast('已刪除', item.title)
          onDeleted?.()
        }}
        onClose={() => setDlg(null)}
      />
    </>
  )
}

export function CourseMenu({ course, onDeleted }: { course: Course; onDeleted?: () => void }) {
  const [dlg, setDlg] = useState<'rename' | 'delete' | null>(null)
  return (
    <>
      <ActionMenu
        label="管理"
        items={[
          { label: '更名課程', icon: <Pencil {...ic} />, onSelect: () => setDlg('rename') },
          { label: '刪除課程', icon: <Trash2 {...ic} />, destructive: true, separatorBefore: true, onSelect: () => setDlg('delete') },
        ]}
      />
      <PromptDialog
        open={dlg === 'rename'}
        title="更名課程"
        label="課程名稱"
        initial={course.name}
        confirmLabel="儲存名稱"
        onSubmit={v => {
          renameCourse(course.id, v)
          toast('已更名')
        }}
        onClose={() => setDlg(null)}
      />
      <ConfirmDialog
        open={dlg === 'delete'}
        title={`刪除課程「${course.name}」？`}
        description="課程內所有筆記、心智圖與快閃卡都會被永久刪除，無法復原。"
        confirmLabel="刪除課程"
        onConfirm={() => {
          deleteCourse(course.id)
          toast('已刪除課程', course.name)
          onDeleted?.()
        }}
        onClose={() => setDlg(null)}
      />
    </>
  )
}
