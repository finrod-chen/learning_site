import { useEffect, useState } from 'react'
import { Cloud, CloudOff } from 'lucide-react'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ToastProvider } from '@/components/ui/toast'
import { Badge } from '@/components/ui/badge'
import { Logo } from '@/ui/Logo'
import { PlayerBar } from '@/ui/PlayerBar'
import { usePlayer } from '@/lib/player'
import { TokenDialog } from '@/ui/Dialogs'
import { useTheme } from '@/lib/theme'
import { href, useRoute } from '@/lib/router'
import { setToken, useSync } from '@/lib/store'
import { ROUTE_TYPE } from '@/lib/types'
import { Home } from '@/views/Home'
import { Course } from '@/views/Course'
import { ItemView } from '@/views/Viewers'
import { Editor } from '@/views/Editor'
import { InsightsPage, MixedQuizPage } from '@/views/QuizHub'

/** Sends the browser through the Cloudflare Access login, then back to the app. */
function relogin() {
  window.location.assign(`/cdn-cgi/access/login/${location.hostname}?redirect_url=${encodeURIComponent('/')}`)
}

function SyncBadge({ onAuth }: { onAuth: () => void }) {
  const s = useSync()
  const map = {
    idle: { variant: 'secondary', text: '本機' },
    syncing: { variant: 'secondary', text: '同步中' },
    synced: { variant: 'success', text: '已同步' },
    offline: { variant: 'warning', text: '離線，已存本機' },
    error: { variant: 'warning', text: '同步失敗，稍後重試' },
    auth: { variant: 'warning', text: '需要密碼' },
    login: { variant: 'warning', text: '登入已過期，點此重新登入' },
  } as const
  const m = map[s.state]
  const Icon = s.state === 'offline' || s.state === 'error' ? CloudOff : Cloud
  return (
    <button type="button" className="sync" onClick={s.state === 'auth' ? onAuth : s.state === 'login' ? relogin : undefined} aria-live="polite" disabled={s.state !== 'auth' && s.state !== 'login'}>
      <Badge variant={m.variant} size="sm"><Icon aria-hidden="true" />{m.text}</Badge>
    </button>
  )
}

function Router({ path }: { path: string }) {
  const seg = path.split('/').filter(Boolean)
  if (seg[0] === 'c' && seg[1]) {
    const cid = seg[1]
    const section = seg[2] ?? 'notes'
    const type = ROUTE_TYPE[section] ?? 'note'
    if (type === 'audio') return <Course courseId={cid} section={section} />
    if (type === 'quiz' && seg[3] === 'mixed') return <MixedQuizPage courseId={cid} />
    if (type === 'quiz' && seg[3] === 'insights') return <InsightsPage courseId={cid} />
    if (seg[3] === 'new') return <Editor key={`new-${cid}-${section}`} courseId={cid} type={type} />
    if (seg[3] && seg[4] === 'edit') return <Editor key={seg[3]} courseId={cid} type={type} itemId={seg[3]} />
    if (seg[3]) return <ItemView key={seg[3]} courseId={cid} itemId={seg[3]} review={seg[4] === 'review'} />
    return <Course courseId={cid} section={section} />
  }
  return <Home />
}

export default function App() {
  const [theme, setTheme] = useTheme()
  const path = useRoute()
  const [askToken, setAskToken] = useState(false)
  const s = useSync()
  const player = usePlayer()
  useEffect(() => {
    if (s.state === 'auth') setAskToken(true)
  }, [s.state])
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [path])
  return (
    <ToastProvider position="bottom-center">
      <header className="topbar">
        <div className="topbar-in">
          <a className="brand" href={href('/')} aria-label="JustNote Learning 首頁">
            <Logo size={32} />
            <span className="brand-name">JustNote Learning</span>
          </a>
          <div className="topbar-right">
            <SyncBadge onAuth={() => setAskToken(true)} />
            <Button variant="outline" size="icon" aria-label={theme === 'dark' ? '切換為淺色' : '切換為深色'} aria-pressed={theme === 'dark'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
              {theme === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
            </Button>
          </div>
        </div>
      </header>
      <main className={player.itemId ? 'shell has-player' : 'shell'} key={path.split('/').slice(0, 5).join('/')}>
        <Router path={path} />
      </main>
      <PlayerBar />
      <TokenDialog open={askToken} onSubmit={setToken} onClose={() => setAskToken(false)} />
    </ToastProvider>
  )
}
