import { useCallback, useEffect, useState } from 'react'

interface InstallEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const KEY = 'jn:install:dismissed'
const SNOOZE_DAYS = 14

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

function snoozed(): boolean {
  try {
    const t = Number(localStorage.getItem(KEY) ?? 0)
    return t > 0 && Date.now() - t < SNOOZE_DAYS * 86400000
  } catch {
    return false
  }
}

/** Install state: Chrome/Android gives a real prompt, iOS Safari needs manual steps, installed apps hide it all. */
export function useInstall() {
  const [event, setEvent] = useState<InstallEvent | null>(null)
  const [installed, setInstalled] = useState(isStandalone)
  const [hidden, setHidden] = useState(snoozed)

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setEvent(e as InstallEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setEvent(null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const install = useCallback(async () => {
    if (!event) return
    await event.prompt()
    const { outcome } = await event.userChoice
    if (outcome === 'accepted') setInstalled(true)
    setEvent(null)
  }, [event])

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(KEY, String(Date.now()))
    } catch {
      /* ignore */
    }
    setHidden(true)
  }, [])

  const ios = isIOS()
  // show only where installing is actually possible
  const available = !installed && !hidden && (event !== null || ios)
  return { available, canPrompt: event !== null, ios, install, dismiss }
}
