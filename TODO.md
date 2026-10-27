# 📋 Lista de Tareas Pendientes (TODO) — Animigos

## 🖼️ Tarea Pendiente: Revisión y Actualización de Imágenes del Catálogo de Animes

### 📌 Contexto
Durante la sincronización mensual completa con MyAnimeList (octubre 2026), se descubrieron e incorporaron **10.529 nuevos animes**, alcanzando un total de **30.777 animes** en la base de datos:
- ✅ **Top 1.000:** Totalmente actualizado con pósters originales en alta resolución (HD) y miembros en tiempo real (**0 placeholders** restantes en el Top 1.000).
- ⏳ **Resto del catálogo (> puesto #1.000):** Existen títulos que aún conservan la URL por defecto `https://cdn.myanimelist.net/images/anime/placeholder.jpg` y requieren actualización de sus portadas.

---

### 🎯 Tareas Específicas (Checklist)

- [ ] **1. Barrido de portadas restantes de MyAnimeList:**
  - Ejecutar el comando optimizado `sync_mal_monthly` con `--pages=0` o en tramos (ej. offsets 1.000 al 23.000) aprovechando que ya extrae la URL HD (`re.sub(r'/r/\d+x\d+/', '/', raw_img)`) y el conteo de miembros.
  - *Estimación:* Aprox. 10–12 minutos en segundo plano con `--delay=1.0`.

- [ ] **2. Enriquecimiento cruzado desde AniList / Dataset Maestro:**
  - Cruzar con las columnas `coverImage_large` y `coverImage_extraLarge` de `anime_dataset_2018_2026/csv/anime_master_catalogo.csv` para aquellos animes que ya contaban con imágenes de AniList en alta fidelidad.

- [ ] **3. Fallback visual en el Frontend:**
  - Asegurar que el componente `AnimeCard.tsx` muestre un placeholder con gradiente estilizado, iniciales del título o logo de Animigos ante URLs rotas o que contengan `placeholder.jpg`.

---

*Fecha de registro: 27 de octubre de 2026*
