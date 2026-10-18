import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Estilos base de Bootstrap 5 y su bundle JS (modales, dropdowns, tooltips)
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'
// Estilos personalizados y tokens de diseño de Animigos
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
