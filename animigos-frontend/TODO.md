# 📋 Recordatorios y Tareas Pendientes — Animigos Frontend

Este archivo registra mejoras y funcionalidades pendientes para implementar en fases posteriores.

---

## 🌐 1. SEO Social & Open Graph (Meta Tags)
* **Objetivo**: Garantizar que cuando un usuario comparta un enlace de Animigos en Discord, WhatsApp, Twitter/X o Telegram, se genere una tarjeta visual interactiva con portada, descripción y título atractivo.
* **Archivos a modificar**:
  - `index.html` (metadatos base).
* **Etiquetas a incluir**:
  - `<meta property="og:type" content="website" />`
  - `<meta property="og:title" content="Animigos — Descubre y elige qué ver en grupo" />`
  - `<meta property="og:description" content="Vota animes con tus amigos y encuentra el consenso perfecto con el Algoritmo de Felicidad Grupal." />`
  - `<meta property="og:image" content="/assets/og-preview.png" />`
  - `<meta property="og:url" content="https://animigos.app" />`
  - `<meta name="twitter:card" content="summary_large_image" />`
* **Pendiente adicional**: Diseñar y exportar la imagen de portada `og-preview.png` (1200x630 px).

---

## 📱 2. Progressive Web App (PWA) & Web App Manifest
* **Objetivo**: Permitir que los usuarios instalen Animigos en sus teléfonos (Android/iOS) y computadoras como si fuera una aplicación nativa, con su propio icono en la pantalla de inicio y navegación a pantalla completa.
* **Archivos y componentes a crear**:
  - `public/manifest.webmanifest`: Definición de nombre, colores temáticos (`theme_color`, `background_color`) e iconos de varios tamaños (192x192, 512x512).
  - Vínculo en `index.html`: `<link rel="manifest" href="/manifest.webmanifest" />` y `<meta name="theme-color" content="#0b0e17" />`.
  - Iconos PWA: Icono con máscara (*maskable icon*) para compatibilidad con Android.
  - (Opcional) Service Worker básico con `vite-plugin-pwa` para almacenamiento en caché offline de la interfaz.

---

## 🚀 3. Siguientes Pasos del Desarrollo Actual
- [x] Configuración de Bootstrap 5 y diseño base en `main.tsx` e `index.css`.
- [ ] Entender el rol y estructura de `main.tsx`.
- [ ] Migrar el Core Engine (`happiness-score`, `guest-session`, `catalog-data`) a `src/core/`.
- [ ] Crear la barra de navegación responsive (Navbar) con gestión de sesión de invitado.
- [ ] Construir la sala de votación y el catálogo dinámico.
