import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import { clearLegacyDataOnce } from './services/storage'

// PWA: registra el service worker y actualiza la app automáticamente
// cuando hay una versión nueva (sin interrumpir al usuario)
registerSW({ immediate: true })

// Antes de montar nada que lea localStorage (cursos, progreso, notas).
clearLegacyDataOnce()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
