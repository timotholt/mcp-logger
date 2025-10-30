import { startLogStream } from './ws.js'

async function fetchMetadata() {
  try {
    const res = await fetch('/meta')
    if (!res.ok) return null
    return await res.json()
  } catch (err) {
    return null
  }
}

const MAX_ENTRIES = 1000

function createElement(tag, className) {
  const el = document.createElement(tag)
  if (className) el.className = className
  return el
}

function formatTimestamp(ts) {
  try {
    return new Date(ts).toLocaleTimeString()
  } catch (err) {
    return ts
  }
}

export function createApp(root) {
  const state = {
    entries: [],
    meta: null
  }

  const container = createElement('div', 'logger')
  const header = createElement('div', 'logger-header')
  header.textContent = 'Loading MCP Logger metadata...'
  container.appendChild(header)
  const table = createElement('table', 'log-table')
  const thead = createElement('thead')
  const headerRow = createElement('tr')
  ;['Time', 'Level', 'Client', 'Session', 'Message'].forEach((label) => {
    const th = createElement('th')
    th.textContent = label
    headerRow.appendChild(th)
  })
  thead.appendChild(headerRow)
  table.appendChild(thead)

  const tbody = createElement('tbody')
  table.appendChild(tbody)
  container.appendChild(table)
  root.appendChild(container)

  function renderHeader() {
    if (!state.meta) {
      header.textContent = 'MCP Logger'
      return
    }
    const version = state.meta.version ? `v${state.meta.version}` : 'v?.?'
    const build = state.meta.buildNumber != null ? `build #${state.meta.buildNumber}` : ''
    const started = state.meta.startedAt
      ? new Date(state.meta.startedAt).toLocaleString()
      : 'unknown'
    header.textContent = `MCP Logger ${version} ${build} — Started ${started}`
  }

  function render() {
    tbody.innerHTML = ''
    state.entries.slice(-MAX_ENTRIES).forEach((entry) => {
      const row = createElement('tr')
      const cells = [
        formatTimestamp(entry.timestamp),
        entry.level,
        entry.clientId || '',
        entry.sessionId || '',
        entry.message
      ]
      cells.forEach((value) => {
        const td = createElement('td')
        td.textContent = value
        row.appendChild(td)
      })
      tbody.appendChild(row)
    })
  }

  function handleEvent(event) {
    if (event.event === 'bootstrap' && Array.isArray(event.payload)) {
      state.entries = event.payload
      render()
      return
    }
    if (event.event === 'append' && event.payload) {
      state.entries.push(event.payload)
      if (state.entries.length > MAX_ENTRIES) {
        state.entries = state.entries.slice(-MAX_ENTRIES)
      }
      render()
    }
    if (event.event === 'clear') {
      state.entries = []
      render()
    }
  }

  startLogStream(handleEvent)

  fetchMetadata().then((meta) => {
    if (meta) {
      state.meta = meta
      renderHeader()
    } else {
      header.textContent = 'MCP Logger'
    }
  })
}
