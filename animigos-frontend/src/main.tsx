import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
// Estilos base de Bootstrap 5 y su bundle JS (modales, dropdowns, tooltips)
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'
// Estilos personalizados y tokens de diseño de Animigos
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext'
import { queryClient } from './shared/queryClient'

// Si un nuevo deploy en Vercel invalida el hash de un chunk lazy en una pestaña antigua,
// recargamos automáticamente una sola vez para obtener el bundle actualizado.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  const reloadKey = 'animigos_vite_preload_reload'
  const lastReload = Number(sessionStorage.getItem(reloadKey) || '0')
  if (Date.now() - lastReload > 10000) {
    sessionStorage.setItem(reloadKey, String(Date.now()))
    window.location.reload()
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
