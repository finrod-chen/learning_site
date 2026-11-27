import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Maximize2, Minimize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Item } from '@/lib/types'

/** Dark mode is a class on <html>; watch it so a visual can follow the app theme. */
function useDark(): boolean {
  return useSyncExternalStore(
    cb => {
      const mo = new MutationObserver(cb)
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
      return () => mo.disconnect()
    },
    () => document.documentElement.classList.contains('dark'),
    () => false,
  )
}

// Receives theme changes from the app. Only the parent window can reach a sandboxed frame, and the handler only sets one attribute.
const BRIDGE = `<script>addEventListener('message',function(e){var t=e.data&&e.data.jnTheme;if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t)})</script>`

/** Adds the starting theme and the theme listener to a standalone HTML page. */
export function prepareVisual(html: string, dark: boolean): string {
  const theme = dark ? 'dark' : 'light'
  let out = html
  if (/<html[\s>]/i.test(out)) {
    out = out.replace(/<html([^>]*)>/i, (_m, attrs: string) => `<html${attrs.replace(/\sdata-theme\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i, '')} data-theme="${theme}">`)
  } else {
    out = `<!doctype html><html data-theme="${theme}"><head><meta charset="utf-8"></head><body>${out}</body></html>`
  }
  return /<head[\s>]/i.test(out) ? out.replace(/<head([^>]*)>/i, (m) => m + BRIDGE) : out.replace(/<html([^>]*)>/i, (m) => m + `<head>${BRIDGE}</head>`)
}

/**
 * Shows a standalone HTML explainer in a sandboxed frame. No allow-same-origin: the page cannot read the app's data,
 * cookies or storage. Scripts can run, and links open in a new tab.
 */
export function VisualFrame({ html, title, className }: { html: string; title: string; className?: string }) {
  const ref = useRef<HTMLIFrameElement>(null)
  const dark = useDark()
  // the starting theme is baked in once per html; later switches go through postMessage so the animation keeps its state
  const initial = useRef(dark)
  const doc = useMemo(() => prepareVisual(html, initial.current), [html])
  const send = useCallback(() => ref.current?.contentWindow?.postMessage({ jnTheme: dark ? 'dark' : 'light' }, '*'), [dark])
  useEffect(send, [send])
  return (
    <iframe
      ref={ref}
      className={className ?? 'visual-frame'}
      title={title}
      srcDoc={doc}
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
      allowFullScreen
      referrerPolicy="no-referrer"
      loading="lazy"
      onLoad={send}
    />
  )
}

type FsEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void }
type FsDoc = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> | void }

export function VisualView({ item }: { item: Item }) {
  const frame = useRef<HTMLDivElement>(null)
  // iPhone 的 Safari 不支援元素全螢幕，改用鋪滿畫面的「網頁內全螢幕」。
  const [pseudo, setPseudo] = useState(false)
  useEffect(() => {
    if (!pseudo) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPseudo(false)
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [pseudo])
  const full = () => {
    if (pseudo) return setPseudo(false)
    const d = document as FsDoc
    if (d.fullscreenElement || d.webkitFullscreenElement) {
      void (d.exitFullscreen ? d.exitFullscreen() : d.webkitExitFullscreen?.())
      return
    }
    const el = frame.current as FsEl | null
    if (!el) return
    try {
      if (el.requestFullscreen) return void el.requestFullscreen().catch(() => setPseudo(true))
      if (el.webkitRequestFullscreen) return void el.webkitRequestFullscreen()
    } catch {
      /* fall through */
    }
    setPseudo(true)
  }
  if (!item.content.trim()) return <p className="muted">這份視覺學習是空的，按「編輯」貼上或載入 HTML。</p>
  return (
    <div className={pseudo ? 'visual-wrap visual-pseudo-full' : 'visual-wrap'} ref={frame}>
      <div className="visual-bar">
        <p className="muted">互動式解說：可以暫停、拖曳進度或操作畫面。深色模式會自動跟隨。</p>
        <Button variant="outline" size="sm" onClick={full}>
          {pseudo ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />} {pseudo ? '結束全螢幕' : '全螢幕'}
        </Button>
      </div>
      <VisualFrame html={item.content} title={item.title} />
    </div>
  )
}
