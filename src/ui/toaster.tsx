import { useEffect, useState } from 'react'
import Toast from '@/components/arc/toast/toast'

interface T {
  id: number
  title: string
  description?: string
}
let listener: ((t: T) => void) | null = null
let seq = 0
export function toast(title: string, description?: string) {
  listener?.({ id: ++seq, title, description })
}

export function Toaster() {
  const [t, setT] = useState<T | null>(null)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    listener = next => {
      setT(next)
      setOpen(true)
    }
    return () => {
      listener = null
    }
  }, [])
  if (!t) return null
  return (
    <div className="toaster" aria-live="polite">
      <Toast key={t.id} title={t.title} description={t.description} open={open} onOpenChange={setOpen} duration={3200} />
    </div>
  )
}
