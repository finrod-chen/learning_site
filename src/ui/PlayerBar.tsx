import { useEffect, useState } from 'react'
import { Pause, Play, RotateCcw, RotateCw, SkipBack, SkipForward, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { ActionMenu } from '@/ui/kit'
import { closePlayer, configurePlayer, next, prev, seek, setRate, skip, toggle, usePlayer } from '@/lib/player'
import { getDB, useDB } from '@/lib/store'
import { formatDuration } from '@/lib/audio'

configurePlayer(
  id => getDB().items[id],
  it => getDB().courses[it.courseId]?.name ?? '',
)

const RATES = [0.75, 1, 1.25, 1.5, 1.75, 2]
const ic = { size: 20, strokeWidth: 1.75, 'aria-hidden': true as const }

export function PlayerBar() {
  const p = usePlayer()
  const db = useDB()
  const [drag, setDrag] = useState<number | null>(null)
  const item = p.itemId ? db.items[p.itemId] : undefined
  const gone = !!p.itemId && (!item || item.deleted)
  useEffect(() => {
    if (gone) closePlayer()
  }, [gone])
  if (!p.itemId || gone) return null
  const shown = drag ?? p.current
  return (
    <aside className="player" aria-label="有聲書播放器">
      <div className="player-top">
        <div className="player-info">
          <span className="player-title">{p.title}</span>
          <span className="muted player-sub">{p.error || (p.loading ? '載入中…' : p.subtitle)}</span>
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="關閉播放器" onClick={closePlayer}>
          <X aria-hidden="true" />
        </Button>
      </div>
      <div className="player-seek">
        <span className="player-time">{formatDuration(shown)}</span>
        <Slider
          getAriaLabel={() => '播放進度'}
          value={Math.min(shown, p.duration || 1)}
          min={0}
          max={p.duration || 1}
          step={1}
          largeStep={30}
          disabled={!p.duration}
          onValueChange={v => setDrag(Array.isArray(v) ? v[0] : v)}
          onValueCommitted={v => {
            seek(Array.isArray(v) ? v[0] : v)
            setDrag(null)
          }}
        />
        <span className="player-time">{formatDuration(p.duration)}</span>
      </div>
      <div className="player-ctrls">
        <Button variant="ghost" size="icon" aria-label="上一個" onClick={prev}><SkipBack {...ic} /></Button>
        <Button variant="ghost" size="icon" aria-label="倒退 15 秒" onClick={() => skip(-15)}><RotateCcw {...ic} /></Button>
        <Button size="icon-lg" aria-label={p.playing ? '暫停' : '播放'} onClick={toggle}>{p.playing ? <Pause {...ic} /> : <Play {...ic} />}</Button>
        <Button variant="ghost" size="icon" aria-label="快轉 30 秒" onClick={() => skip(30)}><RotateCw {...ic} /></Button>
        <Button variant="ghost" size="icon" aria-label="下一個" onClick={next}><SkipForward {...ic} /></Button>
        <ActionMenu label={`${p.rate}x`} items={RATES.map(r => ({ label: `${r}x${r === p.rate ? '（目前）' : ''}`, onSelect: () => setRate(r) }))} />
      </div>
    </aside>
  )
}
