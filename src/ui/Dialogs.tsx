import { useEffect, useState, type FormEvent } from 'react'
import { Dialog, DialogContent } from '@/components/arc/dialog/dialog'
import { Button } from '@/components/arc/button/button'
import { Input } from '@/components/arc/input/input'

interface PromptProps {
  open: boolean
  title: string
  description?: string
  label: string
  initial?: string
  confirmLabel: string
  onSubmit: (value: string) => void
  onClose: () => void
}

export function PromptDialog({ open, title, description, label, initial = '', confirmLabel, onSubmit, onClose }: PromptProps) {
  const [value, setValue] = useState(initial)
  useEffect(() => {
    if (open) setValue(initial)
  }, [open, initial])
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!value.trim()) return
    onSubmit(value.trim())
    onClose()
  }
  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent title={title} description={description}>
        <form className="dialog-form" onSubmit={submit}>
          <Input label={label} value={value} onChange={e => setValue(e.target.value)} autoFocus maxLength={120} />
          <div className="dialog-actions">
            <Button type="button" variant="ghost" onClick={onClose}>取消</Button>
            <Button type="submit" disabled={!value.trim()}>{confirmLabel}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface ConfirmProps {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  danger?: boolean
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmDialog({ open, title, description, confirmLabel, danger = true, onConfirm, onClose }: ConfirmProps) {
  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent title={title} description={description}>
        <div className="dialog-actions">
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function TokenDialog({ open, onSubmit, onClose }: { open: boolean; onSubmit: (v: string) => void; onClose: () => void }) {
  return (
    <PromptDialog
      open={open}
      title="需要同步密碼"
      description="雲端同步受到保護。輸入密碼後，資料會自動同步；不輸入也能繼續在本機使用。"
      label="同步密碼"
      confirmLabel="儲存密碼"
      onSubmit={onSubmit}
      onClose={onClose}
    />
  )
}
