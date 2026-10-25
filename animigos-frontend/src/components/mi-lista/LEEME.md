# Mi Lista — rediseño

Sección "Mi Lista" (antes `animigos.app/personal-lists`) rehecha en React + TypeScript.
Todo vive en esta carpeta y no modifica estilos globales (todas las clases usan el prefijo `ml-`).

## Cómo integrarla

```tsx
import { MiLista } from './components/mi-lista/MiLista'

<MiLista />
```

El CSS se importa solo desde `MiLista.tsx`. Usa las fuentes `--font-heading` y `--font-body` de `index.css`
y los íconos de `lucide-react` (ya están en el proyecto). Para la vista previa local: `npm run dev` → `/#mi-lista`.

## Qué cambió respecto a la versión anterior

| Antes | Ahora |
|---|---|
| Lista, filtros, panel "Agregar" y tags, todo a la vista | 3 pestañas: **Animes / Carpetas / Tags** |
| 5 filtros siempre visibles | Botón **Filtros** plegable + filtros activos como pastillas que se quitan con un clic |
| Panel lateral "Agregar a Mi Lista" | Botón **Agregar anime** → diálogo |
| Carpetas mezcladas con los animes | Pestaña propia, con portadas en abanico y nota promedio |
| Nota como select verde | **Sello (hanko)** con la nota; se cambia haciendo clic sobre él |
| "Episodios: 28 / 28" en texto | Barra de marcas tipo tira de película + botón **+1 ep** |
| Cabecera con contadores sueltos | **Ficha de la lista**: barra repartida por estado, nota media y un "lomo" マイリスト |
| Sin vista general por categoría | **Ver todos**: estantería de pósters de la categoría elegida, agrupada por temporada, estudio o nota |

Se mantienen: nota personal 1-10 (escala MAL), estados y favoritos, tags, carpetas con promedio,
mini resumen al hacer clic en un anime, recomendar a un amigo (un anime, una carpeta o la selección filtrada)
y el acento automático según el género dominante.

## Pendiente / conectar con backend

- Los datos de ejemplo están en `mi-lista-data.ts` (`LISTA_INICIAL`, `CARPETAS_INICIALES`, `TAGS_INICIALES`).
  Los cambios solo viven en el estado de React; falta guardarlos en la API.
- `RecomendarDialog.tsx` y `AgregarDialog.tsx` tienen comentarios `TODO backend` donde va la llamada real.
- No se migró el botón "Probar Importar Selección" de la versión anterior.
- Algunas URLs de pósters de `data/anime-data.ts` están rotas (p. ej. Vinland Saga S2, Steins;Gate 0).
  La sección muestra un póster de respaldo cuando una imagen no carga.

## Archivos

- `MiLista.tsx`: componente principal (estado, cabecera, pestañas, filtros)
- `AnimeFila.tsx`: fila de un anime + menú de acciones
- `PestanaCarpetas.tsx`, `PestanaTags.tsx`: las otras dos pestañas
- `AnimeDetalleDialog.tsx`, `RecomendarDialog.tsx`, `AgregarDialog.tsx`, `VerTodosDialog.tsx`: diálogos (`<dialog>` nativo, igual que `LoginModal`)
- `piezas.tsx`: sello de nota, progreso de episodios, diálogo y menú reutilizables
- `mi-lista-data.ts`: tipos, escala de notas y datos de ejemplo
- `mi-lista.css`: estilos de la sección
