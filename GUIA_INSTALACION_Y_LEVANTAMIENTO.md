# 🚀 Guía Didáctica de Instalación, Configuración y Levantamiento: Proyecto Animigos

¡Bienvenido a la guía integral de puesta en marcha de **Animigos**! Esta plataforma full-stack está diseñada para la recomendación inteligente de anime, seguimiento de episodios (Agenda), consenso grupal algorítmico y salas colaborativas (*Watch Parties*) en tiempo real.

---

## 🗺️ 1. Mapa de Arquitectura y Flujo de Comunicación

El sistema opera bajo una arquitectura desacoplada y reactiva:

```
┌─────────────────────────────────────────────────────────────┐
│                   NAVEGADOR CLIENTE (WEB)                   │
│             http://localhost:5173 (React 19 + Vite)         │
└──────────────┬──────────────────────────────▲───────────────┘
               │                              │
     Peticiones HTTP REST             WebSockets en Vivo
     (/api/animes, /api/users...)     (ws://localhost:8000/ws/room/...)
               │                              │
┌──────────────▼──────────────────────────────┴───────────────┐
│                 BACKEND DJANGO + DAPHNE                     │
│                http://127.0.0.1:8000 (ASGI)                 │
│                                                             │
│   • Django REST Framework (Endpoints y Servicios de Negocio) │
│   • Django Channels + Daphne (Servidor WebSocket)           │
│   • Motor de Recomendación y Algoritmo de Felicidad         │
└──────────────────────────────┬──────────────────────────────┘
                               │
            Conexión Híbrida Inteligente
            (Verifica PostgreSQL; si no responde, conmuta a SQLite)
                               │
             ┌─────────────────┴─────────────────┐
             ▼                                   ▼
┌─────────────────────────┐         ┌─────────────────────────┐
│     POSTGRESQL (DB)     │         │      SQLITE 3 (DB)      │
│  (Producción / AWS RDS) │   O     │  (Desarrollo Inmediato) │
│  animigos_db : 5432     │         │  animigos-backend/      │
│                         │         │  db.sqlite3 (~150 MB)   │
└─────────────────────────┘         └─────────────────────────┘
```

---

## 📋 2. Requisitos Previos del Sistema

Antes de comenzar, asegúrate de tener instaladas las siguientes herramientas en tu sistema operativo (Windows, Linux o macOS):

1. **Node.js**: Versión `18.x`, `20.x` o superior (incluye `npm`).
   - Verifica con: `node -v` y `npm -v`.
2. **Python**: Versión `3.11.x` o `3.12.x`.
   - Verifica con: `python --version` (o `python3 --version`).
3. **Git**: Para control de versiones y clonación del proyecto.
4. *(Opcional)* **PostgreSQL**: Versión 14 o superior (solo si deseas usar PostgreSQL en lugar de SQLite local).

---

## 💻 3. Paso a Paso: Levantamiento del Backend (Django)

El backend reside en el directorio `animigos-backend/`.

### 3.1. Acceder al directorio
Abre una terminal en la raíz del proyecto y entra a la carpeta del backend:
```bash
cd animigos-backend
```

---

### 3.2. Crear y Activar el Entorno Virtual (Python venv)

El entorno virtual aísla las librerías del proyecto para evitar conflictos con otras instalaciones de Python.

- **En Windows (PowerShell / CMD):**
  ```powershell
  # Crear entorno si no existe
  python -m venv .venv

  # Activar entorno (PowerShell)
  .\.venv\Scripts\Activate.ps1
  # (Si PowerShell bloquea scripts, ejecuta antes: Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass)
  
  # O en CMD tradicional:
  .\.venv\Scripts\activate.bat
  ```

- **En Linux o macOS:**
  ```bash
  python3 -m venv .venv
  source .venv/bin/activate
  ```

*(Sabrás que está activo cuando veas `(.venv)` al inicio de tu línea de comandos).*

---

### 3.3. Instalar Dependencias de Python

Con el entorno virtual activo, instala los paquetes listados en `requirements.txt`:
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

> **Librerías principales que se instalarán:**
> - `Django`: Framework web central.
> - `djangorestframework`: Creación de endpoints REST y serializadores.
> - `django-cors-headers`: Manejo de CORS para permitir peticiones desde el frontend.
> - `channels` y `daphne`: Servidor ASGI para WebSockets en tiempo real.
> - `psycopg[binary]`: Driver nativo de conexión para PostgreSQL.
> - `google-generativeai`: Integración con Gemini AI para traducción y resúmenes de sinopsis.

---

### 3.4. Configurar Variables de Entorno (`.env`)

Crea un archivo llamado `.env` dentro de la carpeta `animigos-backend/` (si no existe ya). Puedes basarte en el siguiente ejemplo:

```env
# Configuración básica de Django
DJANGO_DEBUG=True
DJANGO_SECRET_KEY=django-insecure-animigos-dev-key-change-in-production

# Base de Datos PostgreSQL (Opcional en desarrollo)
POSTGRES_DB=animigos_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=tu_contraseña_aqui
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432

# Clave de API de Google Gemini (Para traducción inteligente de sinopsis)
GEMINI_API_KEY=tu_gemini_api_key_opcional
```

> [!NOTE]
> **Mecanismo Híbrido Resiliente de Base de Datos:**
> El archivo `config/settings.py` cuenta con una comprobación automática de conectividad. Si PostgreSQL no está instalado o su servicio está detenido, Django **conmutará automáticamente a SQLite (`db.sqlite3`)**, permitiéndote trabajar de inmediato sin configurar un servidor de bases de datos.

---

### 3.5. Ejecutar Migraciones de Base de Datos

Aplica la estructura de tablas a la base de datos:
```bash
python manage.py migrate
```

---

### 3.6. Carga de Datos y Creación de Administradores

El repositorio ya incluye un archivo `db.sqlite3` precargado con miles de animes, géneros y temporadas. Sin embargo, si estás inicializando una base de datos nueva o deseas configurar los usuarios administradores:

1. **Crear Administradores de Desarrollo:**
   Ejecuta el script automatizado para generar las cuentas de administrador preconfiguradas:
   ```bash
   python scripts/create_admins.py
   ```
   *(Crea usuarios con acceso al panel de Django y consola de administración con contraseña por defecto `villarroel123`).*

2. **(Opcional) Carga Masiva de Animes desde Cero:**
   Si tu base de datos está vacía y deseas poblarla:
   ```bash
   # Carga catálogo base de animes
   python manage.py load_anime_data

   # O carga masiva ampliada
   python manage.py load_anime_bulk
   ```

---

### 3.7. Iniciar el Servidor de Backend

Inicia el servidor de desarrollo (que corre sobre **Daphne ASGI**, gestionando HTTP y WebSockets simultáneamente):
```bash
python manage.py runserver 127.0.0.1:8000
```

- Endpoint de API REST: `http://127.0.0.1:8000/api/`
- Panel de Administración Django: `http://127.0.0.1:8000/admin/`

---

## 🎨 4. Paso a Paso: Levantamiento del Frontend (React + Vite)

El frontend reside en el directorio `animigos-frontend/`.

### 4.1. Acceder al directorio
Abre **otra ventana de terminal** (manteniendo el backend en ejecución) y navega a la carpeta del frontend:
```bash
cd animigos-frontend
```

---

### 4.2. Instalar Dependencias de Node.js

Ejecuta el gestor de paquetes para descargar e instalar las librerías:
```bash
npm install
```

> **Librerías principales que se instalarán:**
> - `react` & `react-dom` (v19): Núcleo de la interfaz de usuario.
> - `vite`: Bundler y servidor de desarrollo ultra-rápido.
> - `@tanstack/react-query`: Manejo asíncrono y caché reactiva de datos de la API.
> - `lucide-react`: Sistema de iconografía moderna.
> - `canvas-confetti`: Efectos visuales de celebración en la app.

---

### 4.3. Explicación del Proxy de Desarrollo (`vite.config.ts`)

En modo desarrollo, Vite cuenta con un proxy preconfigurado en `vite.config.ts`:
- Toda petición a `/api/*` se reenvía a `http://127.0.0.1:8000/api/*`.
- Toda petición a `/media/*` se reenvía a `http://127.0.0.1:8000/media/*`.
- Toda conexión WebSocket a `/ws/*` se redirige a `ws://127.0.0.1:8000/ws/*`.

Gracias a esto, **no necesitas configurar CORS ni URLs fijas en el cliente local**.

---

### 4.4. Iniciar el Servidor de Desarrollo del Frontend

Ejecuta:
```bash
npm run dev
```

El servidor iniciará en pocos milisegundos y mostrará una URL similar a:
👉 **`http://localhost:5173/`**

Abre esa dirección en tu navegador web favorito para comenzar a utilizar la plataforma.

---

## 🧪 5. Verificación de Funcionamiento de Módulos Clave

Una vez levantados ambos servicios, puedes navegar por las diferentes secciones y probar su funcionalidad:

| Módulo | URL / Hash | Descripción |
| :--- | :--- | :--- |
| **Inicio / Tablón Social** | `http://localhost:5173/#tablon` | Feed comunitario, animes en tendencia y widget rápido de agenda. |
| **Catálogo y Búsqueda** | `http://localhost:5173/#catalogo` | Explorador con filtros por género, temporadas, estudios y buscador en vivo. |
| **Mi Lista Personal** | `http://localhost:5173/#mi-lista` | Seguimiento de animes: *Viendo, Completado, Pendiente, Dropeado*, notas y conteo de episodios. |
| **Agenda de Episodios** | `http://localhost:5173/#agenda` | Tareas pendientes: contador de capítulos atrasados, cálculo de tiempo de maratón y próximos estrenos. |
| **Listas Grupales / Watch Party** | `http://localhost:5173/#listas` | Creación de salas compartidas, votación en vivo con WebSockets y Algoritmo de Felicidad. |
| **Cronología y Temporadas** | `http://localhost:5173/#temporadas` | Línea de tiempo interactiva con historial y estrenos año por año. |
| **Consola de Administración** | `http://localhost:5173/#admin` | Portal de control de usuarios, moderación y catálogos. |

---

## ⚙️ 6. Apartados Adicionales y Herramientas Especiales

### 6.1. WebSockets y Tiempo Real (Watch Party)
- El backend utiliza `Django Channels` con `InMemoryChannelLayer` en desarrollo local.
- No es obligatorio instalar un servidor de Redis para desarrollo local; las salas y chat funcionan en memoria automáticamente.
- En producción con múltiples servidores, se recomienda conectar `channels_redis` mediante la variable `REDIS_URL`.

### 6.2. Sincronización Mensual con MyAnimeList
Para actualizar la base de datos con nuevos episodios emitidos o cambios de estado:
```bash
cd animigos-backend
python manage.py sync_mal_monthly
```

### 6.3. Descarga de Banners y Pósters en Alta Resolución (TMDB)
Para complementar las imágenes con metadatos de The Movie Database:
```bash
cd animigos-backend
python manage.py load_tmdb_catalog
```

### 6.4. Generación del Build de Producción del Frontend
Para compilar y verificar que el código TypeScript y CSS no contenga errores:
```bash
cd animigos-frontend
npm run build
```
Los archivos optimizados y empaquetados se generarán en la carpeta `dist/`.

---

## 🛠️ 7. Preguntas Frecuentes y Solución de Problemas (Troubleshooting)

### P1: "Error: connect ECONNREFUSED 127.0.0.1:8000"
- **Causa:** El backend de Django no está iniciado o falló al arrancar.
- **Solución:** Revisa la terminal del backend y asegúrate de haber ejecutado `python manage.py runserver 127.0.0.1:8000`.

### P2: "Scripts disabled on this system" en PowerShell (Windows)
- **Causa:** Política de ejecución restrictiva de Windows PowerShell.
- **Solución:** Ejecuta en la terminal:
  ```powershell
  Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
  ```
  y vuelve a ejecutar `.\.venv\Scripts\Activate.ps1`.

### P3: "Port 8000 or 5173 is already in use"
- **Causa:** Hay un proceso anterior aún corriendo en ese puerto.
- **Solución en Windows:**
  ```powershell
  Get-Process -Id (Get-NetTCPConnection -LocalPort 8000).OwningProcess | Stop-Process -Force
  ```
- **Solución en Linux/macOS:**
  ```bash
  kill -9 $(lsof -t -i:8000)
  ```

### P4: "¿Puedo usar la aplicación sin conexión a Internet?"
- **Respuesta:** Sí. Al utilizar el archivo local `db.sqlite3`, todo el catálogo, imágenes locales en caché, usuarios de prueba y algoritmos funcionan de forma totalmente autónoma y offline en tu equipo.

---

*¡Todo listo! Con estos pasos tienes el ecosistema completo de Animigos listo para desarrollar, probar o presentar.* 🍿🎌

