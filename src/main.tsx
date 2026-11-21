import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource-variable/geist'
import '@/components/arc/foundation.css'
import './styles.css'
import App from './App'
import { registerSW } from 'virtual:pwa-register'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

registerSW({ immediate: true })

// Warm the heavy mindmap chunk once the app is idle so opening a mind map feels instant.
const idle = (window as unknown as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 1500))
idle(() => void import('./views/MindmapCanvas'))
