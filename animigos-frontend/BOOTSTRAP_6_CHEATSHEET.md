# Guía Definitiva y Referencia Técnica: Bootstrap 6.0

Esta documentación recopila el funcionamiento, los cambios fundamentales respecto a Bootstrap 5 y la referencia completa de clases, componentes y utilidades de **Bootstrap 6.0.0-alpha.1**.

---

## 1. Filosofía y Grandes Cambios de Arquitectura

Bootstrap 6 es una reconstrucción moderna enfocada en estándares web nativos:
1. **Escrito 100% en TypeScript**: Todo el core de JavaScript ahora ofrece tipos estricto de primer nivel.
2. **Propiedades Lógicas CSS (Logical Properties)**: En lugar de `left`/`right` y `top`/`bottom`, Bootstrap 6 utiliza:
   - `margin-block` (vertical) y `margin-inline` (horizontal).
   - `padding-block` (vertical) y `padding-inline` (horizontal).
   - Soporte nativo para bidireccionalidad (RTL/LTR).
3. **CSS Cascade Layers (`@layer`)**: Las reglas se organizan en capas (`@layer reset, base, components, utilities`) evitando problemas de especificidad (`!important`).
4. **Funciones de Color Modernas**: Soporta `light-dark()` para modo oscuro instantáneo y `color-mix(in oklch, ...)` para transiciones de color y opacidades hiperrealistas.
5. **Web Standards Nativos**: Se reemplazan contenedores simulados antiguos por elementos HTML5 modernos como `<dialog>`.

---

## 2. Breakpoints y Sistema de Rejilla (Grid)

Los puntos de quiebre se adaptaron a monitores de alta resolución actuales. Nota especialmente que **`lg` subió a 1024px** y **`xxl` fue renombrado a `2xl` (1536px)**.

| Breakpoint | Abreviatura | Ancho Mínimo | Ancho Máximo de `.container` |
| :--- | :--- | :--- | :--- |
| **Extra small** | *(ninguna)* | `< 576px` | 100% fluido |
| **Small** | `sm` | `≥ 576px` | `540px` |
| **Medium** | `md` | `≥ 768px` | `720px` |
| **Large** | `lg` | `≥ 1024px` *(antes 992px)* | `960px` |
| **Extra large** | `xl` | `≥ 1280px` *(antes 1200px)* | `1200px` |
| **2X Large** | `2xl` | `≥ 1536px` *(antes xxl 1400px)* | `1440px` |

### Ejemplo de Grid:
```html
<div className="container">
  <div className="row g-4">
    <div className="col-12 col-md-6 col-lg-4 col-2xl-3">
      Tarjeta responsiva
    </div>
  </div>
</div>
```

---

## 3. Escala de Espaciado (Spacers)

En Bootstrap 6 la escala **ya no termina en 5**. Va del **0 al 12** con un valor base `$spacer = 1rem (16px)`:

| Nivel | Multiplicador | Rem | Píxeles aprox. |
| :---: | :--- | :--- | :--- |
| **0** | `0` | `0` | `0px` |
| **1** | `0.25` | `0.25rem` | `4px` |
| **2** | `0.375` | `0.375rem` | `6px` |
| **3** | `0.5` | `0.5rem` | `8px` |
| **4** | `0.75` | `0.75rem` | `12px` |
| **5** | `1.0` *(¡Cuidado! En v5 era 48px)* | `1rem` | `16px` |
| **6** | `1.25` | `1.25rem` | `20px` |
| **7** | `1.5` | `1.5rem` | `24px` |
| **8** | `1.75` | `1.75rem` | `28px` |
| **9** | `2.0` | `2rem` | `32px` |
| **10** | `2.25` | `2.25rem` | `36px` |
| **11** | `2.5` | `2.5rem` | `40px` |
| **12** | `3.0` *(Equivalente al 5 de v5)* | `3rem` | `48px` |

### Utilidades disponibles:
- **Margen**: `m-`, `mt-`, `mb-`, `ms-` (start/izquierda), `me-` (end/derecha), `mx-` (horizontal), `my-` (vertical).
- **Padding**: `p-`, `pt-`, `pb-`, `ps-`, `pe-`, `px-`, `py-`.
- **Gap (en Flex/Grid)**: `gap-0` a `gap-12`, `row-gap-`, `column-gap-`.
- **Espaciadores negativos**: `-1` y `-2` (ej. `mt-n1`, `mt-n2`).

---

## 4. Tipografía y Tamaños de Fuente (T-Shirt Sizes)

Bootstrap 6 eliminó las clases numéricas (`fs-1` a `fs-6`) y la clase `.lead`. Ahora utiliza tallas **T-Shirt** con **Fluid Typography (`clamp()`) integrada**:

| Clase | Definición Fluid Clamp | Equivalente aprox. Desktop |
| :--- | :--- | :--- |
| **`.fs-xs`** | `0.75rem` | 12px |
| **`.fs-sm`** | `0.875rem` | 14px |
| **`.fs-md`** | `1rem` | 16px (tamaño base) |
| **`.fs-lg`** | `clamp(1.125rem, 1rem + 0.625vw, 1.25rem)` | 18px – 20px |
| **`.fs-xl`** | `clamp(1.5rem, 1.1rem + 0.75vw, 1.75rem)` | 24px – 28px |
| **`.fs-2xl`** | `clamp(1.75rem, 1.3rem + 1vw, 2rem)` | 28px – 32px |
| **`.fs-3xl`** | `clamp(2rem, 1.5rem + 1.875vw, 2.5rem)` | 32px – 40px |
| **`.fs-4xl`** | `clamp(2.25rem, 1.75rem + 2.5vw, 3rem)` | 36px – 48px |
| **`.fs-5xl`** | `clamp(3rem, 2rem + 5vw, 4rem)` | 48px – 64px |
| **`.fs-6xl`** | `clamp(3.75rem, 2.5rem + 6.25vw, 5rem)` | 60px – 80px |

---

## 5. Bordes Redondeados (Border Radius)

Bootstrap 6 expandió los radios a una escala numérica del `0` al `9` con base `0.5rem`:

| Clase | Medida | Píxeles |
| :--- | :--- | :--- |
| **`rounded-0`** | `0` | 0px |
| **`rounded-1`** | `0.125rem` | 2px |
| **`rounded-2`** | `0.1875rem` | 3px |
| **`rounded-3`** | `0.25rem` | 4px |
| **`rounded-4`** | `0.375rem` | 6px |
| **`rounded-5`** | `0.5rem` | 8px (base) |
| **`rounded-6`** | `0.625rem` | 10px |
| **`rounded-7`** | `0.75rem` | 12px |
| **`rounded-8`** | `0.875rem` | 14px |
| **`rounded-9`** | `1rem` | 16px |
| **`rounded-pill`** | `50rem` | Forma de cápsula/píldora |
| **`rounded-circle`** | `50%` | Círculo perfecto |

---

## 6. Colores, Temas y Modo Oscuro

### Paleta Semántica
- `primary` (Azul principal)
- `accent` *(Nuevo color oficial en v6 - Índigo/Violeta)*
- `secondary` (Gris neutro)
- `success` (Verde)
- `danger` (Rojo)
- `warning` (Amarillo)
- `info` (Cian)
- `inverse` *(Nuevo en v6 - Alto contraste inverso)*

### Modo Oscuro
Se activa con el atributo HTML estándar:
```html
<html data-bs-theme="dark">
```
Las variables CSS internas de Bootstrap 6 (`--bg-body`, `--fg-body`, `--border-body`) cambian solas gracias a la función CSS nativa `light-dark()`.

### Clases de Tema Contextual (`.theme-*`)
Permiten que un bloque entero cambie de tema sin tener que pintar botón por botón:
```html
<div className="card theme-accent">
  <!-- Los bordes, botones y acentos interiores adoptan el color accent automáticamente -->
</div>
```

---

## 7. Componentes: Nuevos vs Reemplazados

### A. Dialog (Reemplaza a Modal)
Los modales tradicionales de Bootstrap 5 usaban divs con overlays manuales. En Bootstrap 6 se usa la etiqueta HTML nativa `<dialog>`:

```html
<dialog id="miDialog" className="dialog">
  <div className="dialog-header">
    <h5 className="dialog-title">Título</h5>
    <button type="button" className="btn-close" aria-label="Cerrar"></button>
  </div>
  <div className="dialog-body">
    Contenido aquí...
  </div>
  <div className="dialog-footer">
    <button className="btn btn-secondary">Cancelar</button>
    <button className="btn btn-primary">Guardar</button>
  </div>
</dialog>
```
*Tallas*: `.dialog-sm` (280px), `.dialog-lg` (800px), `.dialog-xl` (1140px).

### B. NavOverflow (Barras de navegación inteligentes)
Calcula automáticamente cuándo los enlaces de navegación ya no caben en pantalla y los agrupa en un dropdown "Más..." automáticamente:

```tsx
import { useEffect, useRef } from 'react'
import { NavOverflow } from 'bootstrap'

export function MiNavbar() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ref.current) {
      const instance = NavOverflow.getOrCreateInstance(ref.current)
      return () => instance.dispose()
    }
  }, [])

  return (
    <div ref={ref} className="nav-overflow" data-bs-toggle="nav-overflow">
      <ul className="nav navbar-nav">
        <li className="nav-item"><a className="nav-link" href="#">Inicio</a></li>
      </ul>
    </div>
  )
}
```

### C. Chips (`.chip`)
Píldoras interactivas para etiquetas, filtros o usuarios:
```html
<div className="chip">
  <span>Acción</span>
  <button type="button" className="chip-dismiss" aria-label="Eliminar"></button>
</div>
```

### D. Avatars (`.avatar`)
Contenedor optimizado para fotos de perfil y badges de estado:
```html
<div className="avatar avatar-lg">
  <img src="avatar.jpg" alt="Usuario" />
</div>
```

### E. Drawer (Reemplaza a Offcanvas)
Paneles laterales deslizables con soporte nativo de gestos táctiles.

### F. Otros Componentes Nuevos en JS/SCSS
- **`combobox`**: Select interactivo con búsqueda y autocompletado nativo.
- **`datepicker`**: Selector de fechas nativo.
- **`otp-input`**: Entradas automáticas para códigos de verificación (2FA de 4 o 6 dígitos).
- **`strength`**: Indicador visual de fortaleza de contraseñas.
- **`stepper`**: Barras de progreso de pasos tipo formulario (Paso 1 -> Paso 2 -> Paso 3).

---

## 8. Tabla Rápida de Migración: "No uses esto (v5) → Usa esto (v6)"

| En Bootstrap 5 (Obsoleto) | En Bootstrap 6 (Correcto) | Razón |
| :--- | :--- | :--- |
| `fs-1`, `fs-2`, `fs-4` | `fs-3xl`, `fs-2xl`, `fs-lg` | Ahora usa tallas T-Shirt con `clamp()` fluido. |
| `.lead` | `fs-lg` o `fs-xl` | La clase `.lead` fue eliminada. |
| `col-xxl-*` | `col-2xl-*` | El breakpoint fue renombrado a `2xl` estándar. |
| `my-5` pensando que es gigante | `my-12` | `5` es solo 16px; `12` es el nuevo valor amplio (48px). |
| `<div className="modal">` | `<dialog className="dialog">` | Ahora usa el elemento nativo de HTML5 `<dialog>`. |
| `.offcanvas` | `.drawer` | Reemplazado por el componente Drawer. |
| Modos oscuros con selectores raros | `data-bs-theme="dark"` + CSS `light-dark()` | Estándar de la W3C. |
