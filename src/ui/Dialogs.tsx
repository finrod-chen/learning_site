import { useEffect, useState, type FormEvent } from 'react'
import { AlertDialog, AlertDialogClose, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogPopup, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { DialogClose } from '@/components/ui/dialog'
import { AppDialog } from './AppDialog'
import { TextField } from './kit'

interface PromptProps {
  open: boolean
  title: string
  description?: string
  label: string
  initial?: string
  confirmLabel: string
  secret?: boolean
  onSubmit: (value: string) => void
  onClose: () => void
}

export function PromptDialog({ open, title, description, label, initial = '', confirmLabel, secret, onSubmit, onClose }: PromptProps) {
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
    <AppDialog
      open={open}
      onOpenChange={o => !o && onClose()}
      title={title}
      description={description}
      onSubmit={submit}
      footer={
        <>
          <DialogClose render={<Button variant="ghost" />}>取消</DialogClose>
          <Button type="submit" disabled={!value.trim()}>{confirmLabel}</Button>
        </>
      }
    >
      <TextField label={label} value={value} onChange={e => setValue(e.target.value)} autoFocus maxLength={120} {...(secret ? { type: 'password', autoComplete: 'current-password' } : {})} />
    </AppDialog>
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
    <AlertDialog open={open} onOpenChange={o => !o && onClose()}>
      <AlertDialogPopup>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose render={<Button variant="ghost" />}>取消</AlertDialogClose>
          <AlertDialogClose render={<Button variant={danger ? 'destructive' : 'default'} />} onClick={onConfirm}>
            {confirmLabel}
          </AlertDialogClose>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
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
      secret
      onSubmit={onSubmit}
      onClose={onClose}
    />
  )
}
