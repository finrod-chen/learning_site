import { createItem, getToken } from './store'
import type { Item } from './types'

export interface AudioMeta {
  key: string
  size: number
  mime: string
  duration?: number
}

export function audioMeta(it: Item): AudioMeta | null {
  try {
    const m = JSON.parse(it.content) as AudioMeta
    return m && typeof m.key === 'string' ? m : null
  } catch {
    return null
  }
}

const tokenQuery = (sep: '?' | '&') => (getToken() ? `${sep}t=${encodeURIComponent(getToken())}` : '')
export const audioUrl = (m: AudioMeta) => `/api/audio/${m.key}${tokenQuery('?')}`
export const audioDownloadUrl = (m: AudioMeta, filename: string) => `/api/audio/${m.key}?dl=${encodeURIComponent(filename)}${tokenQuery('&')}`

const authHeaders = (): Record<string, string> => (getToken() ? { 'x-sync-token': getToken() } : {})

export function deleteAudioFile(m: AudioMeta) {
  void fetch(`/api/audio/${m.key}`, { method: 'DELETE', headers: authHeaders() }).catch(() => undefined)
}

export function formatDuration(sec?: number): string {
  if (sec === undefined || !Number.isFinite(sec)) return '--:--'
  const s = Math.max(0, Math.floor(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  const mm = String(m).padStart(h ? 2 : 1, '0')
  return (h ? `${h}:` : '') + `${mm}:${String(r).padStart(2, '0')}`
}

export function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

const EXT_MIME: Record<string, string> = { mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', wav: 'audio/wav', flac: 'audio/flac', webm: 'audio/webm' }
export const AUDIO_ACCEPT = 'audio/*,.mp3,.m4a,.aac,.ogg,.oga,.opus,.wav,.flac'

export function extOf(file: File): string | null {
  const e = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (EXT_MIME[e]) return e
  const t = Object.entries(EXT_MIME).find(([, m]) => m === file.type)
  return t ? t[0] : null
}

export function titleOf(file: File): string {
  return file.name.replace(/\.[^.]+$/, '').trim() || '未命名有聲書'
}

function probeDuration(file: File): Promise<number | undefined> {
  return new Promise(resolve => {
    const a = new Audio()
    const url = URL.createObjectURL(file)
    const done = (d?: number) => {
      URL.revokeObjectURL(url)
      resolve(d !== undefined && Number.isFinite(d) ? Math.round(d) : undefined)
    }
    a.preload = 'metadata'
    a.onloadedmetadata = () => done(a.duration)
    a.onerror = () => done()
    setTimeout(() => done(), 8000)
    a.src = url
  })
}

const PART = 8 * 1024 * 1024

function putPart(url: string, body: Blob, onBytes: (n: number) => void, signal: AbortSignal): Promise<{ partNumber: number; etag: string }> {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest()
    x.open('PUT', url)
    for (const [k, v] of Object.entries(authHeaders())) x.setRequestHeader(k, v)
    x.upload.onprogress = e => onBytes(e.loaded)
    x.onload = () => {
      if (x.status >= 200 && x.status < 300) resolve(JSON.parse(x.responseText))
      else reject(new Error(x.status === 401 ? '需要同步密碼' : `上傳失敗 (${x.status})`))
    }
    x.onerror = () => reject(new Error('網路中斷'))
    x.onabort = () => reject(new DOMException('aborted', 'AbortError'))
    signal.addEventListener('abort', () => x.abort(), { once: true })
    x.send(body)
  })
}

/** Uploads a file to R2 in 8 MB parts, then records it as an audiobook item. */
export async function uploadAudio(file: File, courseId: string, title: string, onProgress: (ratio: number) => void, signal: AbortSignal): Promise<Item> {
  const ext = extOf(file)
  if (!ext) throw new Error('不支援的檔案格式')
  const name = `${crypto.randomUUID()}.${ext}`
  const qs = (extra = '') => `name=${encodeURIComponent(name)}${extra}`
  const duration = await probeDuration(file)

  const created = await fetch(`/api/audio/upload/create?${qs()}`, { method: 'POST', headers: authHeaders(), signal })
  if (created.status === 401) throw new Error('需要同步密碼')
  if (!created.ok) throw new Error(`無法開始上傳 (${created.status})`)
  const { uploadId } = (await created.json()) as { uploadId: string }

  const parts: { partNumber: number; etag: string }[] = []
  let sent = 0
  try {
    const total = Math.max(1, Math.ceil(file.size / PART))
    for (let n = 1; n <= total; n++) {
      const blob = file.slice((n - 1) * PART, n * PART)
      let attempt = 0
      for (;;) {
        try {
          const part = await putPart(`/api/audio/upload/part?${qs(`&uploadId=${encodeURIComponent(uploadId)}&n=${n}`)}`, blob, b => onProgress((sent + b) / file.size), signal)
          parts.push(part)
          break
        } catch (e) {
          if ((e as Error).name === 'AbortError' || ++attempt >= 3) throw e
          await new Promise(r => setTimeout(r, 800 * attempt))
        }
      }
      sent += blob.size
      onProgress(sent / file.size)
    }
    const done = await fetch(`/api/audio/upload/complete?${qs(`&uploadId=${encodeURIComponent(uploadId)}`)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ parts }),
      signal,
    })
    if (!done.ok) throw new Error(`無法完成上傳 (${done.status})`)
  } catch (e) {
    void fetch(`/api/audio/upload/abort?${qs(`&uploadId=${encodeURIComponent(uploadId)}`)}`, { method: 'POST', headers: authHeaders() }).catch(() => undefined)
    throw e
  }
  const meta: AudioMeta = { key: name, size: file.size, mime: EXT_MIME[ext], ...(duration !== undefined ? { duration } : {}) }
  return createItem({ courseId, type: 'audio', title, content: JSON.stringify(meta) })
}
