# Directiva de Desarrollo y Reglas de Arquitectura: Proyecto Animigos

Este documento define la directiva arquitectónica, los estándares de seguridad, patrones de diseño y reglas de desarrollo obligatorias para todo el ciclo de vida del proyecto **Animigos** (plataforma para recomendación de anime, consenso grupal y watch parties en tiempo real).

---

## 1. Arquitectura de Software y Reutilización (DRY & Modularity)

### 1.1 Principio DRY (Don't Repeat Yourself)
- Extraer invariablemente utilidades puras, formateadores (fechas, duraciones, cadenas), constantes canónicas y validadores en módulos compartidos e independientes:
  - Frontend: `src/shared/`, `src/utils/`, `src/constants/`
  - Backend: `core/utils/`, `shared/formatters.py`, `core/constants.py`
- Cero duplicación de lógica de negocio o de transformación de datos.

### 1.2 Arquitectura por Capas y Separación de Responsabilidades
El código debe organizarse en 3 capas desacopladas:
1. **Capa de Presentación (UI Components):**
   - Componentes puros de React.
   - Reciben datos y funciones de callback exclusivamente vía `props`.
   - Prohibido acoplarlos a llamadas de red directas (`fetch`, `axios`) o manipulación de estado de negocio global.
2. **Capa de Lógica / Hooks:**
   - Custom Hooks (`useWatchParty`, `useRooms`, `useRecommendations`, etc.).
   - Orquestación del ciclo de vida, eventos de WebSockets, sincronización reactiva y manejo de estado local/global.
3. **Capa de Datos / Servicios:**
   - Módulos de API (`services/api.ts`, `services/adminApi.ts`).
   - Abstracción completa de peticiones HTTP, parseo de respuestas, interceptores de autenticación y manejo de caché.

### 1.3 Component-Driven Development
- Desarrollo atómico y modular: tarjetas de anime, modales, chips de género, badges de quórum y medidores de felicidad deben ser componentes atómicos e independientes.
- Tematización dinámica (estilos por género, tonalidades de sala) implementada mediante **variables CSS / design tokens compartidos** (`--genre-accent`, `--admin-surface-1`, etc.), prohibiendo la duplicación de markup JSX para variaciones estéticas.

### 1.4 Tipado Estricto (TypeScript & Python Types)
- En frontend: TypeScript con `strict: true`. Cero uso de `any` injustificado.
- Tipado completo en inputs, outputs, payloads de eventos WebSocket y estados.
- Contratos de datos sincronizados o derivados estrictamente de los endpoints de la API / esquemas de backend.
- En backend: Type hints de Python (PEP 484) y validación estricta con Django REST Framework Serializers / Pydantic.

---

## 2. Seguridad, Backend for Frontend (BFF) y Acceso a Datos

### 2.1 Zero Trust en el Cliente
- **Prohibido realizar consultas directas a la base de datos desde el frontend.** Todas las operaciones de lectura y mutación pasan obligatoriamente por la capa de backend (APIs REST / Endpoints controlados / Server Actions).
- **Prohibido exponer variables privilegiadas** (`SERVICE_ROLE_KEY`, contraseñas de DB, secrets de firma JWT, API keys privadas de terceros) en bundles de cliente. Solo variables públicas prefijadas con `VITE_` y estrictamente necesarias para el cliente.
- Si se emplean servicios BaaS (Supabase/Firebase), la seguridad debe delegarse a políticas estrictas de **Row Level Security (RLS)** a nivel de PostgreSQL, nunca en filtros cosméticos del cliente (`.eq('user_id', id)`).

### 2.2 Validación Dual e Inviolable
- El frontend valida para retroalimentación visual inmediata (UX).
- **El backend revalida y sanitiza de forma obligatoria e ineludible cada input recibido**, asumiendo que el cliente es hostil.
- Uso de esquemas fuertemente tipados (Zod / DRF Serializers) para validar payloads de formularios, parámetros de búsqueda y mensajes de sockets.

### 2.3 Sanitización y Mitigación de Vulnerabilidades
- **Prevención XSS:** Sanitizar cualquier entrada de usuario antes de renderizarla. Prohibido el uso de `dangerouslySetInnerHTML` salvo con un sanitizador estricto verificado (`DOMPurify`).
- **Prevención SQL Injection:** Uso mandatorio del ORM de Django con consultas parametrizadas. Prohibida la concatenación de cadenas crudas en queries SQL.
- **Manejo Seguro de Sesiones:** Tokens de sesión / refresh tokens almacenados en cookies con flags `HttpOnly`, `Secure` y `SameSite=Lax/Strict`. Prohibido almacenar JWTs o credenciales sensibles desprotegidas en `localStorage`.

---

## 3. Coordinación en Tiempo Real y Watch Parties

### 3.1 Autoridad del Servidor (Server-Authoritative Pattern)
- El backend/servidor central es la **única fuente de verdad** para el estado de sincronización (timestamp de reproducción, play, pause, saltos de episodio).
- Los clientes envían intenciones/solicitudes (`request_seek`, `request_play`), y el servidor valida roles y permisos (anfitrión vs. espectador) antes de emitir la confirmación a la sala.

### 3.2 Resiliencia de Red y Rate Limiting
- Rate limiting y throttling por cliente/socket para eventos de alta frecuencia (chat en vivo, spam de reacciones, acciones de reproducción) para mitigar flooding y ataques DoS.
- Conexiones en tiempo real (WebSockets / Django Channels) diseñadas con:
  - Detección de desconexión y heartbeat (ping/pong).
  - Reconexión automática con *exponential backoff*.
  - Sincronización delta del estado tras restablecer la conexión.

---

## 4. Integración de APIs Externas, Caché y Rendimiento

### 4.1 Proxy y Caché Intermedia para APIs de Anime (Jikan, MAL, etc.)
- **Prohibido consultar APIs públicas de anime directamente desde cada cliente de usuario.**
- Toda sincronización externa se procesa mediante una **capa proxy/backend en Django** con almacenamiento en caché (Redis / PostgreSQL) para metadatos estáticos o de baja volatilidad (sinopsis, géneros, temporadas, pósters, estudios), evitando exceder cuotas o suspensiones por *rate limits*.

### 4.2 Optimización de Activos y Renderizado
- Imágenes servidas en formatos modernos (`WebP`/`AVIF`), con *lazy loading*, placeholders de error controlados y dimensiones explícitas para mitigar saltos de diseño (CLS).
- Paginación basada en cursor para feeds extensos o catálogos y virtualización de listas para chats masivos o historiales extensos.

### 4.3 Gestión de Estado y Deduplicación de Consultas
- Centralización de peticiones en servicios reactivos para evitar llamadas HTTP duplicadas (*request deduplication*), garantizando actualizaciones optimistas seguras con reversión (*rollback*) ante fallo.

---

## 5. Estándares de Entrega de Código

Cada propuesta, refactorización o adición de código debe:
1. **Identificar y eliminar redundancias:** Reutilizar utilidades y componentes existentes antes de crear duplicados.
2. **Explicar el porqué arquitectónico:** Justificar decisiones de diseño, seguridad, capas o tipado.
3. **Entregar código de producción:** Completo, modular, libre de código muerto, con manejo explícito de errores y estados de carga/fallo.
