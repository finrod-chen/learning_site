import { toastManager } from '@/components/ui/toast'

/** Shows a short confirmation; the provider lives in App. */
export function toast(title: string, description?: string) {
  toastManager.add({ title, description, timeout: 3200 })
}
