/// <reference types="@cloudflare/workers-types" />

interface Env {
  KV: KVNamespace
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
  if (o.type !== 'note' && o.type !== 'mindmap' && o.type !== 'flashcards') return null
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

function merge(into: Record<string, Rec>, incoming: unknown, kind: 'c' | 'i') {
  if (!Array.isArray(incoming)) return
  for (const raw of incoming) {
    const r = sane(raw, kind)
    if (!r) continue
    const cur = into[r.id]
    if (!cur || r.updatedAt > cur.updatedAt) into[r.id] = r
  }
}

async function handleSync(request: Request, env: Env): Promise<Response> {
  if (env.SYNC_TOKEN && request.headers.get('x-sync-token') !== env.SYNC_TOKEN) {
    return json({ error: 'unauthorized' }, 401)
  }
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
    merge(store.courses, body.courses, 'c')
    merge(store.items, body.items, 'i')
    await env.KV.put(DB_KEY, JSON.stringify(store))
  }
  return json({ courses: Object.values(store.courses), items: Object.values(store.items), serverTime: Date.now() })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/api/sync' && (request.method === 'GET' || request.method === 'POST')) {
      return handleSync(request, env)
    }
    if (url.pathname === '/api/health') return json({ ok: true })
    if (url.pathname.startsWith('/api/')) return json({ error: 'not found' }, 404)
    return new Response('Not found', { status: 404 })
  },
} satisfies ExportedHandler<Env>
