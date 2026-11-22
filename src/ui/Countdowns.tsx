import { useEffect, useState, type FormEvent } from 'react'
import { CalendarClock, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/arc/button/button'
import { Dialog, DialogContent } from '@/components/arc/dialog/dialog'
import { DropdownMenu } from '@/components/arc/dropdown-menu/dropdown-menu'
import { Input } from '@/components/arc/input/input'
import { ConfirmDialog } from '@/ui/Dialogs'
import { toast } from '@/ui/toaster'
import { describeDays, formatDate, listCountdowns, removeCountdown, saveCountdown, type CountdownRow } from '@/lib/countdown'
import { useDB } from '@/lib/store'

const PRESETS = ['報名日', '報名截止日', '考試日', '放榜日']
const ic = { size: 16, strokeWidth: 1.75 }

function CountdownDialog({ open, courseId, initial, onClose }: { open: boolean; courseId: string; initial: CountdownRow | null; onClose: () => void }) {
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  useEffect(() => {
    if (!open) return
    setName(initial?.name ?? '')
    setDate(initial?.date ?? '')
  }, [open, initial])
  const valid = name.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(date)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!valid) return
    saveCountdown({ id: initial?.id, courseId, name, date })
    toast(initial ? '已更新倒數' : '已新增倒數', name.trim())
    onClose()
  }
  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent title={initial ? '編輯倒數' : '新增倒數'} description="替重要的日期取個名字，系統會自動算出還剩幾天。">
        <form className="dialog-form" onSubmit={submit}>
          <Input label="名稱" value={name} onChange={e => setName(e.target.value)} maxLength={40} placeholder="例如：考試日" autoFocus />
          <div className="cd-presets" role="group" aria-label="常用名稱">
            {PRESETS.map(p => (
              <Button key={p} type="button" variant="ghost" size="sm" onClick={() => setName(p)}>{p}</Button>
            ))}
          </div>
          <Input label="日期" type="date" value={date} onChange={e => setDate(e.target.value)} />
          <div className="dialog-actions">
            <Button type="button" variant="ghost" onClick={onClose}>取消</Button>
            <Button type="submit" disabled={!valid}>儲存倒數</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function CountdownCard({ row, onEdit, onDelete }: { row: CountdownRow; onEdit: () => void; onDelete: () => void }) {
  const d = describeDays(row.days)
  return (
    <li className="cd-card" data-past={row.days < 0 || undefined} data-today={row.days === 0 || undefined}>
      <div className="cd-head">
        <span className="cd-name">{row.name}</span>
        <DropdownMenu
          label="管理"
          items={[
            { label: '編輯', icon: <Pencil {...ic} />, onSelect: onEdit },
            { label: '刪除', icon: <Trash2 {...ic} />, destructive: true, separatorBefore: true, onSelect: onDelete },
          ]}
        />
      </div>
      <p className="cd-count" aria-label={d.text}>
        <span className="cd-big">{d.big}</span>
        {d.unit && <span className="cd-unit">{d.unit}</span>}
      </p>
      <p className="muted cd-date">{formatDate(row.date)}</p>
    </li>
  )
}

export function CountdownStrip({ courseId }: { courseId: string }) {
  const db = useDB()
  const rows = listCountdowns(db, courseId)
  const [editing, setEditing] = useState<CountdownRow | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<CountdownRow | null>(null)
  return (
    <section className="cd-strip" aria-labelledby="cd-h">
      <div className="cd-bar">
        <h2 id="cd-h" className="quiz-h"><CalendarClock size={18} strokeWidth={1.75} aria-hidden="true" /> 倒數</h2>
        <Button variant="secondary" size="sm" onClick={() => setCreating(true)}>
          <Plus size={14} strokeWidth={1.75} aria-hidden="true" /> 新增倒數
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="muted">還沒有倒數。可以新增報名日、考試日或放榜日，隨時看到還剩幾天。</p>
      ) : (
        <ul className="cd-grid">
          {rows.map(r => (
            <CountdownCard key={r.id} row={r} onEdit={() => setEditing(r)} onDelete={() => setDeleting(r)} />
          ))}
        </ul>
      )}
      <CountdownDialog open={creating || editing !== null} courseId={courseId} initial={editing} onClose={() => (setCreating(false), setEditing(null))} />
      <ConfirmDialog
        open={deleting !== null}
        title={`刪除倒數「${deleting?.name ?? ''}」？`}
        description="刪除後無法復原。"
        confirmLabel="刪除"
        onConfirm={() => {
          if (deleting) removeCountdown(deleting.id)
          toast('已刪除倒數')
        }}
        onClose={() => setDeleting(null)}
      />
    </section>
  )
}
