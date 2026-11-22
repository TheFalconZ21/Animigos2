# Guía de Puesta en Marcha: Integraciones Externas y Auto-Tracking

Esta guía documenta paso a paso todo lo necesario para activar en producción y en local:
1. **MyAnimeList (OAuth2 + PKCE)** — sincronización bidireccional (importar lista y auto-push al marcar capítulos).
2. **AniList (OAuth2 GraphQL + importación pública)** — sincronización bidireccional e importación instantánea por `@usuario`.
3. **Auto-Tracker de Crunchyroll y Netflix** — extensión de navegador Manifest V3 (`animigos-extension/`).
4. **Importador histórico de Netflix** — carga directa de `NetflixViewingHistory.csv`.

---

## Checklist Rápido

- [ ] Registrar aplicación en **MyAnimeList** y obtener `MAL_CLIENT_ID` y `MAL_CLIENT_SECRET`.
- [ ] Registrar cliente en **AniList** y obtener `ANILIST_CLIENT_ID` y `ANILIST_CLIENT_SECRET`.
- [ ] Agregar las variables OAuth2 al archivo `.env` del backend en **EC2** (y local si pruebas en localhost).
- [ ] Subir los cambios (`git push origin main` para Vercel) y actualizar + reiniciar `animigos-daphne` en **EC2**.
- [ ] Instalar la extensión `animigos-extension/` en Chrome/Edge/Brave o Firefox y pegar tu token desde **Perfil → Configuración → Integraciones**.
- [ ] (Opcional) Subir `NetflixViewingHistory.csv` para importar tu historial previo de Netflix.

---

## Paso 1: Obtener credenciales de MyAnimeList (MAL API v2)

El proceso es gratuito e inmediato (sin espera de aprobación manual).

1. Inicia sesión en MyAnimeList y entra a:
   - https://myanimelist.net/apiconfig/create
2. Completa el formulario con estos datos exactos para **producción**:
   - **App Name:** `Animigos`
   - **App Type:** `web` *(obligatorio para recibir `Client Secret`)*
   - **App Description:** `Social anime tracker and recommendation platform with two-way list sync.`
   - **App Redirect URL:** `https://api.animigos.app/api/users/integrations/mal/callback/`
   - **Homepage URL:** `https://www.animigos.app`
   - **Commercial / Non-Commercial:** `Non-Commercial` (o `Hobbyist`)
   - **Name / Company Name:** tu nombre o `Animigos`
   - **Purpose of Use:** `Personal / Community Anime List Sync`
3. Acepta los términos de la API y haz clic en **Submit**.
4. En https://myanimelist.net/apiconfig haz clic en **Edit** sobre tu app y copia:
   - `Client ID` → `MAL_CLIENT_ID`
   - `Client Secret` → `MAL_CLIENT_SECRET`

> **Reglas importantes de MAL:**
> - La `App Redirect URL` debe coincidir **carácter por carácter** con `MAL_REDIRECT_URI` (incluyendo la barra `/` final).
> - MAL solo permite **una** Redirect URL por aplicación. Si también quieres probar OAuth en local, crea una segunda app (`Animigos Local`) con Redirect URL `http://127.0.0.1:8000/api/users/integrations/mal/callback/`.

---

## Paso 2: Obtener credenciales de AniList (API v2 GraphQL)

El proceso es gratuito e inmediato.

1. Inicia sesión en AniList y entra a:
   - https://anilist.co/settings/developer
2. Haz clic en **Create New Client**.
3. Completa los 2 campos:
   - **Name:** `Animigos`
   - **Redirect URL:** `https://api.animigos.app/api/users/integrations/anilist/callback/`
4. Haz clic en **Save** y copia:
   - `ID` → `ANILIST_CLIENT_ID`
   - `Secret` → `ANILIST_CLIENT_SECRET`

> **Notas de AniList:**
> - Los tokens OAuth2 de AniList duran **1 año**.
> - Igual que MAL, si pruebas en local crea un segundo cliente con `http://127.0.0.1:8000/api/users/integrations/anilist/callback/`.
> - Incluso sin configurar OAuth, los usuarios ya pueden importar su lista pública de AniList ingresando su `@usuario` en la pestaña **Integraciones**.

---

## Paso 3: Configurar variables `.env` en el Backend

### A. En Producción (AWS EC2)
Conéctate por SSH al servidor EC2 y edita `/home/ubuntu/Animigos2/animigos-backend/.env`:

```bash
ssh -i d:\Codigos\Animigos2\animigos-key.pem ubuntu@34.231.198.115
nano /home/ubuntu/Animigos2/animigos-backend/.env
```

Agrega al final del archivo:

```env
FRONTEND_URL=https://www.animigos.app
BACKEND_PUBLIC_URL=https://api.animigos.app

# MyAnimeList OAuth2 + PKCE
MAL_CLIENT_ID=pega_aqui_tu_mal_client_id
MAL_CLIENT_SECRET=pega_aqui_tu_mal_client_secret
MAL_REDIRECT_URI=https://api.animigos.app/api/users/integrations/mal/callback/

# AniList OAuth2 GraphQL
ANILIST_CLIENT_ID=pega_aqui_tu_anilist_id
ANILIST_CLIENT_SECRET=pega_aqui_tu_anilist_secret
ANILIST_REDIRECT_URI=https://api.animigos.app/api/users/integrations/anilist/callback/
```

Guarda con `Ctrl+O`, `Enter`, `Ctrl+X`.

### B. En Local (Opcional, para pruebas en tu PC)
En `animigos-backend/.env` agrega:

```env
FRONTEND_URL=http://localhost:5173
BACKEND_PUBLIC_URL=http://127.0.0.1:8000
MAL_CLIENT_ID=tu_mal_local_client_id
MAL_CLIENT_SECRET=tu_mal_local_client_secret
MAL_REDIRECT_URI=http://127.0.0.1:8000/api/users/integrations/mal/callback/
ANILIST_CLIENT_ID=tu_anilist_local_id
ANILIST_CLIENT_SECRET=tu_anilist_local_secret
ANILIST_REDIRECT_URI=http://127.0.0.1:8000/api/users/integrations/anilist/callback/
```

---

## Paso 4: Desplegar los cambios a Producción

1. **Frontend (Vercel):**
   Desde tu PC, sube el commit a `main` (Vercel desplegará automáticamente `www.animigos.app`):
   ```bash
   git push origin main
   ```
2. **Backend (AWS EC2):**
   En la sesión SSH de EC2 ejecuta (no se requieren migraciones de base de datos):
   ```bash
   cd /home/ubuntu/Animigos2
   git pull origin main
   sudo systemctl restart animigos-daphne
   sudo systemctl status animigos-daphne --no-pager
   ```
3. **Verificación rápida en la web:**
   - Entra a `https://www.animigos.app` → **Perfil** → botón de **Configuración (engranaje)** → pestaña **Integraciones**.
   - Prueba **Conectar MAL** y **Conectar OAuth (AniList)**. Tras autorizar, volverás a Animigos con tu lista sincronizada.
   - Verifica que el checkbox *"Enviar automáticamente mis episodios y notas..."* (`auto_push`) quede activado para que cada episodio que marques en Animigos se refleje automáticamente en MAL y AniList.

---

## Paso 5: Poner en marcha el Auto-Tracker de Crunchyroll y Netflix

Como ni Crunchyroll ni Netflix ofrecen API pública de sincronización de usuarios, el tracking automático funciona mediante la extensión Manifest V3 incluida en `animigos-extension/`.

### 5.1 Instalar la extensión

- **En Chrome / Edge / Brave:**
  1. Abre `chrome://extensions` (o `edge://extensions` / `brave://extensions`).
  2. Activa **Modo de desarrollador** (arriba a la derecha).
  3. Haz clic en **Cargar descomprimida** (*Load unpacked*).
  4. Selecciona la carpeta `d:\Codigos\Animigos2\animigos-extension`.

- **En Firefox:**
  1. Abre `about:debugging#/runtime/this-firefox`.
  2. Haz clic en **Cargar complemento temporal...**.
  3. Selecciona el archivo `d:\Codigos\Animigos2\animigos-extension\manifest.json`.

### 5.2 Vincular la extensión con tu cuenta de Animigos

1. En `https://www.animigos.app`, abre **Perfil → Configuración → Integraciones**.
2. En la tarjeta **Auto-Tracking Crunchyroll & Netflix**, haz clic en **Generar Token** y luego en **Copiar** (el token empieza con `animigos_sync_...`).
3. Haz clic en el ícono de la extensión **Animigos Sync** en tu navegador:
   - **URL del servidor Animigos:** `https://api.animigos.app` *(o `http://127.0.0.1:8000` si pruebas en local)*.
   - **Token de sincronización:** pega tu token `animigos_sync_...`.
   - Deja activado el interruptor superior y haz clic en **Guardar**.

### 5.3 Cómo funciona y cómo probarlo

1. Abre cualquier capítulo de anime en **Crunchyroll** (`crunchyroll.com/watch/...`) o **Netflix** (`netflix.com/watch/...`).
2. Al alcanzar el **85% de reproducción** (en videos de al menos 2 minutos), la extensión:
   - Envía el título y número de episodio al endpoint `POST /api/users/integrations/extension/track/` con tu header `X-Animigos-Sync-Token`.
   - Actualiza automáticamente tu progreso en **Mi Lista** de Animigos (y pasa el anime a `visto` si llegaste al último capítulo).
   - Si tienes **MyAnimeList** y/o **AniList** vinculados con `auto_push` activo, Animigos replica el capítulo a esas cuentas automáticamente en segundo plano.
   - Muestra un badge **`✓` verde** en el ícono de la extensión y guarda el registro en el historial del popup.

---

## Paso 6: Importar historial previo de Netflix (`NetflixViewingHistory.csv`)

Para cargar todo el anime que ya viste en Netflix anteriormente sin esperar a reproducirlo de nuevo:

1. Entra a https://www.netflix.com/viewingactivity con tu cuenta de Netflix.
2. Baja hasta el final de la página y haz clic en **Descargar todo** (*Download all*) para obtener `NetflixViewingHistory.csv`.
3. En Animigos, abre **Perfil → Configuración → Integraciones** → tarjeta **Importar Historial de Netflix (CSV)**.
4. Haz clic en **Subir CSV** y selecciona tu archivo. Animigos filtrará automáticamente los títulos que coincidan con el catálogo de anime y actualizará tus capítulos vistos.

---

## Solución de Problemas Comunes

| Síntoma | Causa probable | Solución |
|---|---|---|
| MAL o AniList muestra `invalid_request` / `redirect_uri mismatch` | La URL registrada en MAL/AniList no coincide exactamente con el `.env` | Verifica que ambas terminen en `/` y usen `https://api.animigos.app/api/users/integrations/<mal\|anilist>/callback/`. |
| La extensión muestra badge `ERR` (`HTTP 401`) | Token vacío, mal copiado o regenerado después | Genera/copia nuevamente el token en **Integraciones**, pégalo en el popup y pulsa **Guardar**. |
| La extensión muestra badge `?` amarillo | El título reproducido no es anime o no coincide con el catálogo local | Revisa el historial dentro del popup de la extensión para ver el título exacto detectado. |
| Los cambios en `.env` de EC2 no surten efecto | Faltó reiniciar el servicio ASGI | Ejecuta `sudo systemctl restart animigos-daphne` en EC2. |
