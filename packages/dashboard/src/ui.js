import { startLogStream } from './ws.js'

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
    entries: []
  }

  const container = createElement('div', 'logger')
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
}
