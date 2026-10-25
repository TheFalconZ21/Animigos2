# Directiva de Desarrollo y Reglas de Arquitectura: Proyecto Animigos

---

### 1. Arquitectura de Software y Reutilización (DRY & Modularity)
- **Principio DRY:** Extrae utilidades puras, formateadores, constantes y validadores en módulos compartidos e independientes (`/lib`, `/utils` o `/shared`).
- **Arquitectura por Capas y Separación de Responsabilidades:**
  - **Capa de Presentación:** Componentes puros de UI que reciben datos y callbacks vía props. Sin acoplamiento con lógica de negocio ni llamadas directas de red.
  - **Capa de Lógica / Hooks:** Manejo del ciclo de vida, estado reactivo local/global y orquestación de eventos.
  - **Capa de Datos / Servicios:** Encapsulación de consultas a APIs, base de datos y cache.
- **Component-Driven Development:** Componentes atómicos reutilizables (tarjetas de anime, modales, chips de género, badges de estado). Los temas visuales dinámicos (estilos por género) deben definirse mediante variables CSS / tokens de diseño compartidos, evitando duplicar markup o estructuras JSX.
- **Tipado Estricto (TypeScript):** Modo estricto activado (`strict: true`). Cero uso de `any` injustificado; tipa todos los inputs, outputs, payloads y estados. Sincroniza o deriva los contratos de datos directamente de los esquemas de base de datos o endpoints.

---

### 2. Seguridad, Backend for Frontend (BFF) y Acceso a Datos
- **Zero Trust en el Cliente:**
  - Prohibido realizar consultas directas a la base de datos desde el frontend. Toda operación sensible de lectura/escritura debe pasar por la capa de backend.
  - Jamás expongas variables de entorno privilegiadas (`SERVICE_ROLE_KEY`, secrets de DB, API keys privadas de terceros) en bundles de cliente. Solo variables públicas prefijadas y necesarias.
  - Si se utiliza un cliente BaaS (Supabase/Firebase), la seguridad debe delegarse a políticas estrictas de Row Level Security (RLS) a nivel de base de datos, nunca en filtros cosméticos del cliente (`.eq('user_id', id)`).
- **Validación Dual e Inviolable:**
  - Valida en el frontend para UX rápida, pero revalida y sanitiza de forma obligatoria en el backend.
  - Utiliza esquemas fuertemente tipados (Zod / Serializers) compartidos entre cliente y servidor para validar payloads de formularios, parámetros de búsqueda y eventos de sockets.
- **Sanitización y Mitigación de Vulnerabilidades:**
  - Prevención de XSS: Sanitiza cualquier input o mensaje de usuario antes de renderizarlo. No utilices inserciones de HTML crudo (`dangerouslySetInnerHTML`) sin un sanitizador estricto (DOMPurify).
  - Prevención de SQLi: Uso mandatorio de consultas parametrizadas, ORM o query builders tipados.
  - Manejo de Sesiones: Almacena tokens de sesión en cookies `HttpOnly`, `Secure` y con flag `SameSite=Lax/Strict`. No guardes credenciales sensibles ni JWTs desprotegidos en `localStorage`.

---

### 3. Coordinación en Tiempo Real y Watch Parties
- **Autoridad del Servidor (Server-Authoritative Pattern):**
  - El servidor o backend central actúa como la única fuente de verdad para el estado de sincronización (timestamp de video, play/pause, saltos de reproducción).
  - Valida rigurosamente los roles y permisos de la sala (anfitrión vs. espectador) antes de emitir actualizaciones de reproducción a los demás clientes.
- **Resiliencia de Red y Rate Limiting:**
  - Implementa rate limiting y throttling por cliente/socket para eventos frecuentes (chat en vivo, spam de reacciones, acciones de reproducción) para prevenir flooding y ataques DoS.
  - Toda conexión en tiempo real (WebSockets/SSE) debe contemplar manejo de caídas, reconexión automática con exponential backoff y sincronización delta de estado tras reconexión.

---

### 4. Integración de APIs Externas, Caché y Rendimiento
- **Proxy y Caché Intermedia para APIs de Anime (Jikan, MAL, etc.):**
  - Prohibido consultar APIs públicas de anime directamente desde cada cliente de usuario. Diseña una capa proxy/backend con almacenamiento en caché (Redis, HTTP Cache o memoria) para almacenar metadatos que cambian con baja frecuencia (sinopsis, géneros, temporadas, pósters) y evitar suspensiones por rate limits.
- **Optimización de Activos y Renderizado:**
  - Utiliza formatos optimizados (`WebP`/`AVIF`) con lazy loading y dimensiones explícitas para evitar layout shifts (CLS).
  - Implementa paginación basada en cursor para feeds extensos o catálogos y virtualización de listas para chats en vivo o listados masivos.
- **Gestión de Estado y Deduplicación de Consultas:**
  - Centraliza el estado del servidor mediante librerías de data fetching reactivo para evitar peticiones duplicadas (request deduplication) y proveer actualizaciones optimistas seguras.

---

### 5. Estándares de Entrega de Código
Al proponer, crear o refactorizar código:
1. Identifica y elimina redundancias.
2. Explica el porqué arquitectónico.
3. Muestra código de producción completo, modular, con manejo explícito de errores y estados de carga/fallo.
