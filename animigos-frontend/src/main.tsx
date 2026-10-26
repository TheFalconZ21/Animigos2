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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
