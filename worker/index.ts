/// <reference types="@cloudflare/workers-types" />

import { ASSETS } from './assets.generated'

interface Env {
  KV: KVNamespace
  AUDIO: R2Bucket
  SYNC_TOKEN?: string
}

interface Rec {
  id: string
  updatedAt: number
  deleted?: boolean
  [k: string]: unknown
}
interface Store {
  courses: Record<string, Rec>
  items: Record<string, Rec>
}

const DB_KEY = 'db:v1'
const MAX_BODY = 5 * 1024 * 1024
const MAX_CONTENT = 600 * 1024

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })

function sane(r: unknown, kind: 'c' | 'i'): Rec | null {
  if (!r || typeof r !== 'object') return null
  const o = r as Record<string, unknown>
  if (typeof o.id !== 'string' || o.id.length > 80) return null
  if (typeof o.updatedAt !== 'number' || !Number.isFinite(o.updatedAt)) return null
  if (kind === 'c') {
    if (typeof o.name !== 'string') return null
    return { id: o.id, name: o.name.slice(0, 200), createdAt: Number(o.createdAt) || o.updatedAt, updatedAt: o.updatedAt, ...(o.deleted ? { deleted: true } : {}) }
  }
  if (typeof o.courseId !== 'string' || typeof o.title !== 'string') return null
  if (o.type !== 'note' && o.type !== 'mindmap' && o.type !== 'flashcards' && o.type !== 'audio') return null
  const content = typeof o.content === 'string' ? o.content.slice(0, MAX_CONTENT) : ''
  return {
    id: o.id,
    courseId: o.courseId,
    type: o.type,
    title: o.title.slice(0, 200),
    content: o.deleted ? '' : content,
    createdAt: Number(o.createdAt) || o.updatedAt,
    updatedAt: o.updatedAt,
    ...(o.deleted ? { deleted: true } : {}),
  }
}

const AUDIO_NAME = /^[A-Za-z0-9_-]{8,80}\.(mp3|m4a|aac|ogg|oga|opus|wav|flac|webm)$/

function audioKeyOf(r: Rec): string | null {
  if (r.type !== 'audio' || typeof r.content !== 'string') return null
  try {
    const k = (JSON.parse(r.content) as { key?: unknown }).key
    return typeof k === 'string' && AUDIO_NAME.test(k) ? k : null
  } catch {
    return null
  }
}

function merge(into: Record<string, Rec>, incoming: unknown, kind: 'c' | 'i', orphaned: string[] = []) {
  if (!Array.isArray(incoming)) return
  for (const raw of incoming) {
    const r = sane(raw, kind)
    if (!r) continue
    const cur = into[r.id]
    if (!cur || r.updatedAt > cur.updatedAt) {
      // a deleted audiobook frees its R2 object
      if (kind === 'i' && r.deleted && cur && !cur.deleted) {
        const k = audioKeyOf(cur)
        if (k) orphaned.push('audio/' + k)
      }
      into[r.id] = r
    }
  }
}

function authed(request: Request, env: Env, url: URL): boolean {
  if (!env.SYNC_TOKEN) return true
  return (request.headers.get('x-sync-token') ?? url.searchParams.get('t')) === env.SYNC_TOKEN
}

async function handleSync(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (!authed(request, env, new URL(request.url))) return json({ error: 'unauthorized' }, 401)
  const store = ((await env.KV.get(DB_KEY, 'json')) as Store | null) ?? { courses: {}, items: {} }
  if (request.method === 'POST') {
    const text = await request.text()
    if (text.length > MAX_BODY) return json({ error: 'too large' }, 413)
    let body: { courses?: unknown; items?: unknown }
    try {
      body = JSON.parse(text)
    } catch {
      return json({ error: 'bad json' }, 400)
    }
    const orphaned: string[] = []
    merge(store.courses, body.courses, 'c')
    merge(store.items, body.items, 'i', orphaned)
    await env.KV.put(DB_KEY, JSON.stringify(store))
    if (orphaned.length) ctx.waitUntil(env.AUDIO.delete(orphaned))
  }
  return json({ courses: Object.values(store.courses), items: Object.values(store.items), serverTime: Date.now() })
}


const MIME: Record<string, string> = { mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', wav: 'audio/wav', flac: 'audio/flac', webm: 'audio/webm' }
const MAX_PART = 16 * 1024 * 1024

async function handleAudio(request: Request, env: Env, url: URL): Promise<Response> {
  if (!authed(request, env, url)) return json({ error: 'unauthorized' }, 401)
  const rest = url.pathname.slice('/api/audio/'.length)

  // multipart upload: create / part / complete / abort
  if (rest.startsWith('upload/')) {
    const op = rest.slice('upload/'.length)
    const name = url.searchParams.get('name') ?? ''
    if (!AUDIO_NAME.test(name)) return json({ error: 'bad name' }, 400)
    const key = 'audio/' + name
    if (op === 'create' && request.method === 'POST') {
      const ext = name.split('.').pop()!
      const up = await env.AUDIO.createMultipartUpload(key, { httpMetadata: { contentType: MIME[ext] ?? 'application/octet-stream' } })
      return json({ uploadId: up.uploadId })
    }
    const uploadId = url.searchParams.get('uploadId') ?? ''
    if (!uploadId) return json({ error: 'missing uploadId' }, 400)
    const up = env.AUDIO.resumeMultipartUpload(key, uploadId)
    try {
      if (op === 'part' && request.method === 'PUT') {
        const n = Number(url.searchParams.get('n'))
        if (!Number.isInteger(n) || n < 1 || n > 10000) return json({ error: 'bad part' }, 400)
        const buf = await request.arrayBuffer()
        if (buf.byteLength > MAX_PART) return json({ error: 'part too large' }, 413)
        const part = await up.uploadPart(n, buf)
        return json({ partNumber: part.partNumber, etag: part.etag })
      }
      if (op === 'complete' && request.method === 'POST') {
        const body = (await request.json()) as { parts?: R2UploadedPart[] }
        if (!Array.isArray(body.parts) || body.parts.length === 0) return json({ error: 'no parts' }, 400)
        const obj = await up.complete(body.parts)
        return json({ size: obj.size })
      }
      if (op === 'abort' && request.method === 'POST') {
        await up.abort()
        return json({ ok: true })
      }
    } catch (e) {
      return json({ error: String(e instanceof Error ? e.message : e) }, 500)
    }
    return json({ error: 'not found' }, 404)
  }

  // stream / download / delete a stored file
  if (!AUDIO_NAME.test(rest)) return json({ error: 'not found' }, 404)
  const key = 'audio/' + rest
  if (request.method === 'DELETE') {
    await env.AUDIO.delete(key)
    return json({ ok: true })
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 })

  const rangeHeader = request.headers.get('range')
  const obj = await env.AUDIO.get(key, rangeHeader ? { range: request.headers } : undefined)
  if (!obj) return json({ error: 'not found' }, 404)
  const headers = new Headers()
  obj.writeHttpMetadata(headers)
  headers.set('etag', obj.httpEtag)
  headers.set('accept-ranges', 'bytes')
  headers.set('cache-control', 'private, max-age=3600')
  const dl = url.searchParams.get('dl')
  if (dl) headers.set('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(dl)}`)
  let status = 200
  let length = obj.size
  if (rangeHeader && obj.range) {
    const r = obj.range as { offset?: number; length?: number; suffix?: number }
    const offset = r.suffix !== undefined ? Math.max(0, obj.size - r.suffix) : (r.offset ?? 0)
    length = r.suffix !== undefined ? obj.size - offset : (r.length ?? obj.size - offset)
    headers.set('content-range', `bytes ${offset}-${offset + length - 1}/${obj.size}`)
    status = 206
  }
  headers.set('content-length', String(length))
  return new Response(request.method === 'HEAD' ? null : (obj as R2ObjectBody).body, { status, headers })
}

const decoded = new Map<string, Uint8Array>()
function serveStatic(pathname: string, head: boolean): Response {
  let key = pathname
  let asset = ASSETS[key]
  if (!asset) {
    // unknown file-like paths are real 404s; everything else is the SPA shell
    if (/\.[a-z0-9]+$/i.test(pathname)) return new Response('Not found', { status: 404 })
    key = '/index.html'
    asset = ASSETS[key]
  }
  if (key === '/') asset = ASSETS['/index.html']
  let body: BodyInit | null
  if (head) body = null
  else if (asset.text !== undefined) body = asset.text
  else {
    let bytes = decoded.get(key)
    if (!bytes) {
      const bin = atob(asset.b64!)
      bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      decoded.set(key, bytes)
    }
    body = bytes
  }
  const immutable = key.startsWith('/assets/')
  return new Response(body, {
    headers: {
      'content-type': asset.type,
      'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
      'x-content-type-options': 'nosniff',
      ...(key === '/sw.js' ? { 'service-worker-allowed': '/' } : {}),
    },
  })
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/api/sync' && (request.method === 'GET' || request.method === 'POST')) {
      return handleSync(request, env, ctx)
    }
    if (url.pathname.startsWith('/api/audio/')) return handleAudio(request, env, url)
    if (url.pathname === '/api/health') return json({ ok: true })
    if (url.pathname.startsWith('/api/')) return json({ error: 'not found' }, 404)
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 })
    return serveStatic(url.pathname, request.method === 'HEAD')
  },
} satisfies ExportedHandler<Env>
