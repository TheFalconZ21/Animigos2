/**
 * Animigos Sync — Background Service Worker (Manifest V3)
 * Recibe eventos de episodios vistos desde Crunchyroll/Netflix y los envía
 * al endpoint autenticado de Animigos usando X-Animigos-Sync-Token.
 */

const DEFAULT_API_BASE = 'https://api.animigos.app'
const MAX_LOGS = 15

async function getConfig() {
  const data = await chrome.storage.local.get({
    apiBase: DEFAULT_API_BASE,
    syncToken: '',
    enabled: true,
    logs: [],
  })
  return {
    apiBase: (data.apiBase || DEFAULT_API_BASE).trim().replace(/\/+$/, ''),
    syncToken: (data.syncToken || '').trim(),
    enabled: data.enabled !== false,
    logs: Array.isArray(data.logs) ? data.logs : [],
  }
}

async function appendLog(entry) {
  const { logs } = await getConfig()
  const updated = [entry, ...logs].slice(0, MAX_LOGS)
  await chrome.storage.local.set({ logs: updated })
}

function flashBadge(text, color) {
  try {
    chrome.action.setBadgeText({ text })
    chrome.action.setBadgeBackgroundColor({ color })
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '' })
    }, 5000)
  } catch {
    // Ignorar si el navegador no soporta badge temporal
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== 'ANIMIGOS_EPISODE_WATCHED') {
    return false
  }

  ;(async () => {
    const config = await getConfig()
    if (!config.enabled) {
      sendResponse({ ok: false, skipped: true, reason: 'disabled' })
      return
    }
    if (!config.syncToken) {
      flashBadge('!', '#f59e0b')
      sendResponse({ ok: false, reason: 'missing_token' })
      return
    }

    const endpoint = `${config.apiBase}/api/users/integrations/extension/track/`
    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Animigos-Sync-Token': config.syncToken,
        },
        body: JSON.stringify({
          source: message.source,
          title: message.title,
          episode: message.episode,
        }),
      })

      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        flashBadge('ERR', '#ef4444')
        await appendLog({
          at: new Date().toISOString(),
          source: message.source,
          title: message.title,
          episode: message.episode,
          ok: false,
          detail: data.error || `HTTP ${resp.status}`,
        })
        sendResponse({ ok: false, status: resp.status, error: data.error })
        return
      }

      if (data.matched) {
        flashBadge('✓', '#22c55e')
      } else {
        flashBadge('?', '#eab308')
      }

      await appendLog({
        at: new Date().toISOString(),
        source: message.source,
        title: data.anime_title || message.title,
        episode: data.episodes_watched || message.episode,
        ok: Boolean(data.matched),
        detail: data.matched
          ? `Sincronizado (${data.status || 'viendo'})`
          : 'Sin coincidencia en catálogo',
      })

      sendResponse({ ok: true, data })
    } catch (err) {
      flashBadge('ERR', '#ef4444')
      await appendLog({
        at: new Date().toISOString(),
        source: message.source,
        title: message.title,
        episode: message.episode,
        ok: false,
        detail: err instanceof Error ? err.message : 'Error de red',
      })
      sendResponse({ ok: false, error: String(err) })
    }
  })()

  return true
})
