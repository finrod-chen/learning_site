import type { FormEvent, ReactNode } from 'react'
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogPanel, DialogPopup, DialogTitle } from '@/components/ui/dialog'

/** A titled dialog; pass `onSubmit` to make the body and footer one form. */
export function AppDialog({ open, onOpenChange, title, description, children, footer, onSubmit }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; description?: string; children?: ReactNode; footer?: ReactNode; onSubmit?: (e: FormEvent) => void }) {
  const body = (
    <>
      {children && <DialogPanel className="grid gap-4">{children}</DialogPanel>}
      {footer && <DialogFooter>{footer}</DialogFooter>}
    </>
  )
  return (
    <Dialog open={open} onOpenChange={o => onOpenChange(o)}>
      <DialogPopup className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {onSubmit ? <form className="contents" onSubmit={onSubmit}>{body}</form> : body}
      </DialogPopup>
    </Dialog>
  )
}
