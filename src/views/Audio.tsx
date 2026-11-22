import { useEffect, useRef, useState } from 'react'
import { Headphones, Pause, Play } from 'lucide-react'
import { Button } from '@/components/arc/button/button'
import { Dialog, DialogContent } from '@/components/arc/dialog/dialog'
import { Progress } from '@/components/arc/progress/progress'
import { ItemMenu } from '@/ui/Menus'
import { EmptyState } from '@/ui/EmptyState'
import { toast } from '@/ui/toaster'
import { AUDIO_ACCEPT, audioMeta, extOf, formatDuration, formatSize, titleOf, uploadAudio } from '@/lib/audio'
import { play, toggle, usePlayer } from '@/lib/player'
import { listItems, useDB } from '@/lib/store'
import { formatTime } from '@/lib/md'

export function AudioList({ courseId, onUpload }: { courseId: string; onUpload: () => void }) {
  const db = useDB()
  const p = usePlayer()
  const items = listItems(db, courseId, 'audio').sort((a, b) => a.title.localeCompare(b.title, 'zh-Hant', { numeric: true }))
  const queue = items.map(i => i.id)
  if (items.length === 0) {
    return (
      <EmptyState
        title="還沒有有聲書"
        description="上傳 mp3 等音檔，之後就能在這裡直接播放，進度會自動記住。"
        action={<Button variant="secondary" onClick={onUpload}>上傳有聲書</Button>}
      />
    )
  }
  return (
    <ul className="file-list">
      {items.map(it => {
        const meta = audioMeta(it)
        const active = p.itemId === it.id
        const playing = active && p.playing
        return (
          <li key={it.id} className="file-row" data-active={active || undefined}>
            <button
              type="button"
              className="file-link audio-link"
              disabled={!meta}
              aria-label={`${playing ? '暫停' : '播放'}：${it.title}`}
              onClick={() => (active ? toggle() : play(it, queue))}
            >
              <span className="audio-icon" aria-hidden="true">{playing ? <Pause size={18} strokeWidth={1.75} /> : active ? <Play size={18} strokeWidth={1.75} /> : <Headphones size={20} strokeWidth={1.75} />}</span>
              <span className="file-text">
                <span className="file-title">{it.title}</span>
                <span className="file-meta">
                  {meta ? `${formatDuration(meta.duration)} · ${formatSize(meta.size)}` : '檔案資訊遺失'} · {formatTime(it.updatedAt)}
                </span>
              </span>
            </button>
            <ItemMenu item={it} onEdit={() => undefined} />
          </li>
        )
      })}
    </ul>
  )
}

interface Row {
  id: string
  file: File
  title: string
  status: 'wait' | 'up' | 'done' | 'err'
  progress: number
  error?: string
}

export function UploadDialog({ open, courseId, onClose }: { open: boolean; courseId: string; onClose: () => void }) {
  const [rows, setRows] = useState<Row[]>([])
  const [busy, setBusy] = useState(false)
  const [drag, setDrag] = useState(false)
  const [skipped, setSkipped] = useState<string[]>([])
  const ctl = useRef<AbortController | null>(null)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) {
      setRows([])
      setSkipped([])
      setBusy(false)
    }
  }, [open])

  const patch = (id: string, p: Partial<Row>) => setRows(rs => rs.map(r => (r.id === id ? { ...r, ...p } : r)))

  async function start(files: File[]) {
    if (busy) return
    const ok = files.filter(f => extOf(f))
    setSkipped(files.filter(f => !extOf(f)).map(f => f.name))
    if (ok.length === 0) return
    const batch: Row[] = ok.map(f => ({ id: crypto.randomUUID(), file: f, title: titleOf(f), status: 'wait', progress: 0 }))
    setRows(batch)
    setBusy(true)
    const c = new AbortController()
    ctl.current = c
    let done = 0
    for (const r of batch) {
      patch(r.id, { status: 'up' })
      try {
        await uploadAudio(r.file, courseId, r.title, ratio => patch(r.id, { progress: ratio }), c.signal)
        patch(r.id, { status: 'done', progress: 1 })
        done++
      } catch (e) {
        const aborted = (e as Error).name === 'AbortError'
        patch(r.id, { status: 'err', error: aborted ? '已取消' : (e as Error).message })
        if (aborted) break
      }
    }
    setBusy(false)
    ctl.current = null
    if (done) toast(`已上傳 ${done} 個有聲書`)
  }

  const close = () => {
    ctl.current?.abort()
    onClose()
  }
  const allDone = rows.length > 0 && !busy

  return (
    <Dialog open={open} onOpenChange={o => !o && close()}>
      <DialogContent title="上傳有聲書" description="支援 mp3、m4a、wav、ogg、flac。大檔案會分段上傳，上傳中請保持此頁開啟。">
        <div className="upload">
          {rows.length === 0 ? (
            <div
              className="dropzone"
              data-drag={drag || undefined}
              onDragOver={e => {
                e.preventDefault()
                setDrag(true)
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={e => {
                e.preventDefault()
                setDrag(false)
                void start([...e.dataTransfer.files])
              }}
            >
              <p>把音檔拖曳到這裡</p>
              <Button variant="secondary" onClick={() => input.current?.click()}>選擇檔案</Button>
            </div>
          ) : (
            <ul className="upload-list">
              {rows.map(r => (
                <li key={r.id} className="upload-row">
                  <Progress value={Math.round(r.progress * 100)} max={100} label={r.title} showValue />
                  {r.status === 'err' && <p className="form-error" role="alert">{r.error}</p>}
                  {r.status === 'wait' && <p className="muted">等待上傳</p>}
                </li>
              ))}
            </ul>
          )}
          {skipped.length > 0 && <p className="form-error" role="alert">不支援的檔案已略過：{skipped.join('、')}</p>}
          <input ref={input} type="file" accept={AUDIO_ACCEPT} multiple hidden onChange={e => void start([...(e.target.files ?? [])]).then(() => (e.target.value = ''))} />
          <div className="dialog-actions">
            {busy ? <Button variant="secondary" onClick={close}>取消上傳</Button> : <Button variant={allDone ? 'primary' : 'ghost'} onClick={close}>{allDone ? '完成' : '關閉'}</Button>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
