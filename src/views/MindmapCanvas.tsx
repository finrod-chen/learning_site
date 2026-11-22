import { useEffect, useRef } from 'react'
import { Markmap } from 'markmap-view'
import { Transformer } from 'markmap-lib'

const transformer = new Transformer([])

function palette(): string[] {
  const cs = getComputedStyle(document.documentElement)
  const vars = ['--mm-1', '--mm-2', '--mm-3', '--mm-4', '--mm-5', '--mm-6']
  return vars.map(v => cs.getPropertyValue(v).trim()).filter(Boolean)
}

export interface MindmapHandle {
  fit: () => void
}

export default function MindmapCanvas({ md, level, onReady }: { md: string; level: number; onReady?: (h: MindmapHandle) => void }) {
  const svg = useRef<SVGSVGElement>(null)
  const mm = useRef<Markmap | null>(null)
  const theme = useRef('')

  useEffect(() => {
    const render = () => {
      if (!svg.current) return
      const { root } = transformer.transform(md || '# ')
      const colors = palette()
      const opts = {
        autoFit: true,
        duration: 250,
        maxWidth: 280,
        paddingX: 14,
        initialExpandLevel: level === 0 ? -1 : level,
        color: (n: { state?: { path?: string } }) => {
          const i = Number((n.state?.path ?? '1.1').split('.')[1] ?? 0) || 0
          return colors[i % colors.length] ?? 'currentColor'
        },
      }
      if (!mm.current) {
        mm.current = Markmap.create(svg.current, opts, root)
        onReady?.({ fit: () => void mm.current?.fit() })
      } else {
        mm.current.setOptions(opts)
        void mm.current.setData(root)
        void mm.current.fit()
      }
      theme.current = document.documentElement.classList.contains('dark') ? 'dark' : 'light'
    }
    render()
    const onTheme = () => {
      if (theme.current !== (document.documentElement.classList.contains('dark') ? 'dark' : 'light')) render()
    }
    window.addEventListener('jn-theme', onTheme)
    return () => window.removeEventListener('jn-theme', onTheme)
  }, [md, level, onReady])

  useEffect(
    () => () => {
      mm.current?.destroy()
      mm.current = null
    },
    [],
  )

  return <svg ref={svg} className="mm-svg" />
}
