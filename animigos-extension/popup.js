const DEFAULT_API_BASE = 'https://api.animigos.app'

const apiBaseInput = document.getElementById('apiBase')
const syncTokenInput = document.getElementById('syncToken')
const enabledToggle = document.getElementById('enabledToggle')
const saveBtn = document.getElementById('saveBtn')
const clearLogsBtn = document.getElementById('clearLogsBtn')
const statusMsg = document.getElementById('statusMsg')
const logsList = document.getElementById('logsList')

function showStatus(text) {
  statusMsg.textContent = text
  statusMsg.hidden = false
  setTimeout(() => {
    statusMsg.hidden = true
  }, 3000)
}

function renderLogs(logs) {
  logsList.innerHTML = ''
  if (!Array.isArray(logs) || logs.length === 0) {
    const li = document.createElement('li')
    li.className = 'empty'
    li.textContent = 'Aún no se han registrado episodios.'
    logsList.appendChild(li)
    return
  }

  for (const item of logs) {
    const li = document.createElement('li')
    const top = document.createElement('div')
    top.className = 'log-top'

    const titleSpan = document.createElement('span')
    titleSpan.textContent = `${item.title} · Ep. ${item.episode}`

    const stateSpan = document.createElement('span')
    stateSpan.className = item.ok ? 'log-ok' : 'log-err'
    stateSpan.textContent = item.ok ? '✓' : '!'

    top.appendChild(titleSpan)
    top.appendChild(stateSpan)

    const meta = document.createElement('div')
    meta.className = 'log-meta'
    const timeStr = item.at ? new Date(item.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
    meta.textContent = `${item.source || ''} · ${item.detail || ''} ${timeStr ? `(${timeStr})` : ''}`

    li.appendChild(top)
    li.appendChild(meta)
    logsList.appendChild(li)
  }
}

async function loadState() {
  const data = await chrome.storage.local.get({
    apiBase: DEFAULT_API_BASE,
    syncToken: '',
    enabled: true,
    logs: [],
  })
  apiBaseInput.value = data.apiBase || DEFAULT_API_BASE
  syncTokenInput.value = data.syncToken || ''
  enabledToggle.checked = data.enabled !== false
  renderLogs(data.logs)
}

saveBtn.addEventListener('click', async () => {
  const apiBase = (apiBaseInput.value || DEFAULT_API_BASE).trim().replace(/\/+$/, '')
  const syncToken = (syncTokenInput.value || '').trim()
  const enabled = Boolean(enabledToggle.checked)
  await chrome.storage.local.set({ apiBase, syncToken, enabled })
  showStatus('Configuración guardada correctamente.')
})

enabledToggle.addEventListener('change', async () => {
  await chrome.storage.local.set({ enabled: Boolean(enabledToggle.checked) })
})

clearLogsBtn.addEventListener('click', async () => {
  await chrome.storage.local.set({ logs: [] })
  renderLogs([])
  showStatus('Historial local limpiado.')
})

loadState()
