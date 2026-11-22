# Animigos Sync — Extensión de Navegador (Manifest V3)

Extensión oficial de **Animigos** para marcar automáticamente los episodios de anime que ves en **Crunchyroll** y **Netflix** al superar el **85% de reproducción**.

Si además tienes vinculada tu cuenta de **MyAnimeList** o **AniList** en Animigos con `auto_push` activo, el progreso detectado por la extensión también se enviará automáticamente a esas plataformas.

## Instalación en Chrome / Edge / Brave

1. Abre `chrome://extensions` (o `edge://extensions` / `brave://extensions`).
2. Activa **Modo de desarrollador** (esquina superior derecha).
3. Haz clic en **Cargar descomprimida** (*Load unpacked*).
4. Selecciona la carpeta `animigos-extension/` de este repositorio.

## Instalación en Firefox

1. Abre `about:debugging#/runtime/this-firefox`.
2. Haz clic en **Cargar complemento temporal...** (*Load Temporary Add-on...*).
3. Selecciona el archivo `animigos-extension/manifest.json`.

## Configuración

1. Inicia sesión en Animigos (`https://www.animigos.app`), abre **Perfil → Configuración → Integraciones**.
2. En la tarjeta **Auto-Tracking Crunchyroll & Netflix**, haz clic en **Generar Token** y copia el token (`animigos_sync_...`).
3. Haz clic en el ícono de **Animigos Sync** en tu navegador, pega el token y pulsa **Guardar**.
4. ¡Listo! Cada vez que veas un episodio de anime en Crunchyroll o Netflix hasta el 85%, aparecerá un `✓` verde en el ícono de la extensión y tu lista en Animigos se actualizará sola.
