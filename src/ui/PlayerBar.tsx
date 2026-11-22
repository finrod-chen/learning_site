import { useEffect, useState } from 'react'
import { Pause, Play, RotateCcw, RotateCw, SkipBack, SkipForward, X } from 'lucide-react'
import { Button } from '@/components/arc/button/button'
import Slider from '@/components/arc/slider/slider'
import { DropdownMenu } from '@/components/arc/dropdown-menu/dropdown-menu'
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
        <Button variant="ghost" size="sm" aria-label="關閉播放器" onClick={closePlayer}>
          <X size={18} strokeWidth={1.75} aria-hidden="true" />
        </Button>
      </div>
      <Slider
        label="播放進度"
        value={Math.min(shown, p.duration || 1)}
        min={0}
        max={p.duration || 1}
        step={1}
        largeStep={30}
        disabled={!p.duration}
        format={formatDuration}
        onValueChange={setDrag}
        onValueCommit={v => {
          seek(v)
          setDrag(null)
        }}
        start={<span className="player-time">{formatDuration(shown)}</span>}
        end={<span className="player-time">{formatDuration(p.duration)}</span>}
      />
      <div className="player-ctrls">
        <Button variant="ghost" aria-label="上一個" onClick={prev}><SkipBack {...ic} /></Button>
        <Button variant="ghost" aria-label="倒退 15 秒" onClick={() => skip(-15)}><RotateCcw {...ic} /></Button>
        <Button aria-label={p.playing ? '暫停' : '播放'} onClick={toggle}>{p.playing ? <Pause {...ic} /> : <Play {...ic} />}</Button>
        <Button variant="ghost" aria-label="快轉 30 秒" onClick={() => skip(30)}><RotateCw {...ic} /></Button>
        <Button variant="ghost" aria-label="下一個" onClick={next}><SkipForward {...ic} /></Button>
        <DropdownMenu label={`${p.rate}x`} items={RATES.map(r => ({ label: `${r}x${r === p.rate ? '（目前）' : ''}`, onSelect: () => setRate(r) }))} />
      </div>
    </aside>
  )
}
