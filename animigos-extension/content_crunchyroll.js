/**
 * Animigos Sync — Content Script para Crunchyroll
 * Detecta cuando un episodio alcanza >= 85% de reproducción y notifica al Service Worker.
 */

;(function initCrunchyrollTracker() {
  const THRESHOLD = 0.85
  const MIN_DURATION_SEC = 120
  const trackedKeys = new Set()

  function parseEpisodeNumber(text) {
    if (!text) return 1
    const patterns = [
      /\bE(?:p(?:isodio|isode)?)?\.?\s*(\d{1,4})\b/i,
      /\bS\d+\s*E(\d{1,4})\b/i,
      /\bCap(?:ítulo|itulo)?\.?\s*(\d{1,4})\b/i,
      /#(\d{1,4})\b/,
    ]
    for (const rx of patterns) {
      const m = text.match(rx)
      if (m && m[1]) {
        const n = parseInt(m[1], 10)
        if (!Number.isNaN(n) && n > 0) return n
      }
    }
    return 1
  }

  function extractCrunchyrollMetadata() {
    // 1. Selectores actuales del reproductor web de Crunchyroll
    const showEl =
      document.querySelector('[data-t="show-title-link"]') ||
      document.querySelector('a.show-title-link') ||
      document.querySelector('.erc-current-media-info h4') ||
      document.querySelector('[class*="show-title"]')

    const epEl =
      document.querySelector('[data-t="episode-title"]') ||
      document.querySelector('.erc-current-media-info h1') ||
      document.querySelector('h1.title')

    let title = (showEl && showEl.textContent ? showEl.textContent : '').trim()
    const epHeading = (epEl && epEl.textContent ? epEl.textContent : '').trim()

    // 2. Fallback a document.title (ej: "Watch Solo Leveling E12 - ... - Crunchyroll")
    const docTitle = (document.title || '').replace(/\s*[-|]\s*Crunchyroll.*$/i, '').trim()
    if (!title && docTitle) {
      title = docTitle
        .replace(/^Watch\s+/i, '')
        .replace(/^Ver\s+/i, '')
        .split(/\s+-\s+|\s+E\d+/i)[0]
        .trim()
    }

    const episode = parseEpisodeNumber(`${epHeading} ${docTitle}`)
    return { title, episode }
  }

  function checkVideoProgress() {
    if (!location.pathname.includes('/watch/')) return
    const video = document.querySelector('video')
    if (!video || !video.duration || Number.isNaN(video.duration)) return
    if (video.duration < MIN_DURATION_SEC) return

    const ratio = video.currentTime / video.duration
    if (ratio < THRESHOLD) return

    const { title, episode } = extractCrunchyrollMetadata()
    if (!title) return

    const dedupeKey = `${location.pathname}::${title.toLowerCase()}::${episode}`
    if (trackedKeys.has(dedupeKey)) return
    trackedKeys.add(dedupeKey)

    chrome.runtime.sendMessage({
      type: 'ANIMIGOS_EPISODE_WATCHED',
      source: 'crunchyroll',
      title,
      episode,
    })
  }

  // Poll liviano cada 5s (resistente a cambios SPA y recreación del <video>)
  setInterval(checkVideoProgress, 5000)
})()
