import fetch from 'node-fetch'

let state = null

function formatMessage(args) {
  return args
    .map((item) => {
      if (typeof item === 'string') return item
      try {
        return JSON.stringify(item)
      } catch (err) {
        return String(item)
      }
    })
    .join(' ')
}

function mapLevel(method) {
  if (method === 'warn' || method === 'error' || method === 'debug') {
    return method
  }
  return 'info'
}

async function postLog(endpoint, headers, entry) {
  try {
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(headers || {}) },
      body: JSON.stringify(entry)
    })
  } catch (err) {
    // swallow network errors to avoid disrupting caller
  }
}

export function attachLogger(options = {}) {
  if (state) return state

  const endpoint = options.endpoint
  if (!endpoint) {
    throw new Error('attachLogger requires an endpoint option')
  }

  const headers = options.headers
  const clientId = options.clientId || `node-${process.pid}`
  let sessionId = options.sessionId || null
  const levels = options.levels && options.levels.length ? new Set(options.levels) : null

  const original = {}

  function shouldSend(level) {
    if (!levels) return true
    return levels.has(level)
  }

  ;['log', 'info', 'warn', 'error', 'debug'].forEach((method) => {
    original[method] = console[method]
    console[method] = (...args) => {
      const level = mapLevel(method)
      if (shouldSend(level)) {
        const entry = {
          level,
          message: formatMessage(args),
          clientId,
          sessionId,
          timestamp: new Date().toISOString(),
          data: { args }
        }
        postLog(endpoint, headers, entry)
      }
      if (typeof original[method] === 'function') {
        original[method](...args)
      }
    }
  })

  state = {
    detach() {
      Object.keys(original).forEach((method) => {
        console[method] = original[method]
      })
      state = null
    },
    setSession(id) {
      sessionId = id
    }
  }

  return state
}

export function detachLogger() {
  if (state && typeof state.detach === 'function') {
    state.detach()
  }
}

export function setSession(id) {
  if (state && typeof state.setSession === 'function') {
    state.setSession(id)
  }
}
