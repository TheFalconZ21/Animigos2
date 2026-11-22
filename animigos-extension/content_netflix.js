/**
 * Animigos Sync — Content Script para Netflix
 * Detecta cuando un episodio en /watch/* alcanza >= 85% de reproducción y notifica al Service Worker.
 */

;(function initNetflixTracker() {
  const THRESHOLD = 0.85
  const MIN_DURATION_SEC = 120
  const trackedKeys = new Set()

  function parseEpisodeNumber(text) {
    if (!text) return 1
    const patterns = [
      /\b(?:E|Ep\.?|Episode|Episodio|Cap\.?|Capítulo)\s*(\d{1,4})\b/i,
      /\bT\d+\s*:\s*E(\d{1,4})\b/i,
      /\bS\d+\s*:\s*E(\d{1,4})\b/i,
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

  function extractNetflixMetadata() {
    const titleContainer =
      document.querySelector('[data-uia="video-title"]') ||
      document.querySelector('.video-title')

    let title = ''
    let epText = ''

    if (titleContainer) {
      const h4 = titleContainer.querySelector('h4')
      const spans = Array.from(titleContainer.querySelectorAll('span'))
      title = (h4 ? h4.textContent : titleContainer.textContent || '').trim()
      epText = spans.map((s) => s.textContent || '').join(' ').trim()
    }

    if (!title) {
      title = (document.title || '').replace(/\s*[-|]\s*Netflix.*$/i, '').trim()
    }

    // Limpiar posibles sufijos de temporada/episodio pegados al título
    const cleanTitle = title.split(/\s*[:\-]\s*(?:Temporada|Season|Parte|Part|E\d+|Ep\.?\s*\d+)/i)[0].trim()
    const episode = parseEpisodeNumber(`${epText} ${title}`)
    return { title: cleanTitle || title, episode }
  }

  function checkVideoProgress() {
    if (!location.pathname.startsWith('/watch/')) return
    const video = document.querySelector('video')
    if (!video || !video.duration || Number.isNaN(video.duration)) return
    if (video.duration < MIN_DURATION_SEC) return

    const ratio = video.currentTime / video.duration
    if (ratio < THRESHOLD) return

    const { title, episode } = extractNetflixMetadata()
    if (!title) return

    const watchId = location.pathname.split('/')[2] || location.pathname
    const dedupeKey = `${watchId}::${title.toLowerCase()}::${episode}`
    if (trackedKeys.has(dedupeKey)) return
    trackedKeys.add(dedupeKey)

    chrome.runtime.sendMessage({
      type: 'ANIMIGOS_EPISODE_WATCHED',
      source: 'netflix',
      title,
      episode,
    })
  }

  setInterval(checkVideoProgress, 5000)
})()
