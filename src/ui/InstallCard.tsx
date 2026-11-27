import { useState } from 'react'
import { Share, SquarePlus, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DialogClose } from '@/components/ui/dialog'
import { AppDialog } from '@/ui/AppDialog'
import { useInstall } from '@/lib/pwa'

/** Suggests installing the app: a real prompt where the browser supports it, steps on iOS Safari. */
export function InstallCard() {
  const { available, canPrompt, install, dismiss } = useInstall()
  const [steps, setSteps] = useState(false)
  if (!available) return null
  return (
    <section className="install-card" aria-labelledby="install-h">
      <Smartphone size={20} strokeWidth={1.75} aria-hidden="true" className="install-icon" />
      <div className="install-text">
        <h2 id="install-h" className="quiz-h">安裝到手機</h2>
        <p className="muted">像 App 一樣從主畫面開啟，全螢幕、啟動更快，沒網路也能複習。</p>
      </div>
      <div className="install-actions">
        <Button onClick={() => (canPrompt ? void install() : setSteps(true))}>{canPrompt ? '安裝' : '怎麼安裝'}</Button>
        <Button variant="ghost" onClick={dismiss}>稍後再說</Button>
      </div>
      <AppDialog
        open={steps}
        onOpenChange={setSteps}
        title="加到主畫面"
        description="用 Safari 開啟本站，依序操作："
        footer={<DialogClose render={<Button />}>知道了</DialogClose>}
      >
        <ol className="install-steps">
          <li><Share size={16} strokeWidth={1.75} aria-hidden="true" /> 點 Safari 底部（或右上角）的「分享」按鈕</li>
          <li><SquarePlus size={16} strokeWidth={1.75} aria-hidden="true" /> 往下找到「加入主畫面」</li>
          <li>點「新增」，桌面就會出現 JustNote 圖示</li>
        </ol>
        <p className="muted">第一次從主畫面開啟，可能需要重新登入一次。</p>
      </AppDialog>
    </section>
  )
}
