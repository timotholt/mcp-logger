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

  let streamControl = null

  const app = createElement('div', 'logger-app')
  const headerEl = createElement('header', 'logger-app-header')
  const headerText = createElement('div', 'logger-header-text')
  const title = document.createElement('h1')
  title.className = 'logger-title'
  title.textContent = 'MCP Logger'
  const subtitle = document.createElement('p')
  subtitle.className = 'logger-subtitle'
  subtitle.textContent = 'Loading metadata…'
  headerText.appendChild(title)
  headerText.appendChild(subtitle)

  const headerActions = createElement('div', 'logger-header-actions')
  const links = document.createElement('nav')
  links.className = 'logger-links'
  ;[
    { label: 'Health', href: '/health' },
    { label: 'Metadata', href: '/meta' },
    { label: 'Events (SSE)', href: '/events' },
    { label: 'Demo', href: '/demo' }
  ].forEach(({ label, href }) => {
    const anchor = document.createElement('a')
    anchor.href = href
    anchor.textContent = label
    anchor.target = '_blank'
    anchor.rel = 'noopener noreferrer'
    links.appendChild(anchor)
  })
  const clearButton = document.createElement('button')
  clearButton.type = 'button'
  clearButton.className = 'logger-clear'
  clearButton.textContent = 'Clear logs'
  clearButton.disabled = true
  clearButton.addEventListener('click', () => {
    if (streamControl && streamControl.send({ type: 'clear' })) {
      return
    }
    state.entries = []
    render()
  })

  headerActions.appendChild(links)
  headerActions.appendChild(clearButton)
  headerEl.appendChild(headerText)
  headerEl.appendChild(headerActions)

  const content = createElement('div', 'logger-content')
  const table = createElement('table', 'log-table')
  const thead = createElement('thead')
  const tableHeaderRow = createElement('tr')
  ;['Time', 'Level', 'Client', 'Session', 'Message'].forEach((label) => {
    const th = createElement('th')
    th.textContent = label
    tableHeaderRow.appendChild(th)
  })
  thead.appendChild(tableHeaderRow)
  table.appendChild(thead)

  const tbody = createElement('tbody')
  table.appendChild(tbody)
  content.appendChild(table)
  app.appendChild(headerEl)
  app.appendChild(content)
  root.appendChild(app)

  function renderHeader() {
    if (!state.meta) {
      subtitle.textContent = 'Metadata unavailable'
      return
    }
    const version = state.meta.version ? `v${state.meta.version}` : 'v?.?'
    const build = state.meta.buildNumber != null ? `build #${state.meta.buildNumber}` : ''
    const started = state.meta.startedAt
      ? new Date(state.meta.startedAt).toLocaleString()
      : 'unknown'
    const parts = [`${version}`]
    if (build) parts.push(build)
    parts.push(`started ${started}`)
    subtitle.textContent = parts.join(' · ')
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

  function handleStreamStatus(status) {
    const supportsClear = status && status.transport === 'websocket' && status.ready
    clearButton.disabled = !supportsClear
  }

  streamControl = startLogStream(handleEvent, handleStreamStatus)

  fetchMetadata().then((meta) => {
    if (meta) {
      state.meta = meta
      renderHeader()
    } else {
      subtitle.textContent = 'Metadata unavailable'
    }
  })
}
