'use strict'

import { createFetchTransport } from './transportFetch.js'

function toISOString(value) {
  try {
    return new Date(value).toISOString()
  } catch (err) {
    return new Date().toISOString()
  }
}

function normalizeMessage(input) {
  if (input == null) {
    return ''
  }
  if (typeof input === 'string') {
    return input
  }
  try {
    return JSON.stringify(input)
  } catch (err) {
    return String(input)
  }
}

export function createMcpLogger(options = {}) {
  if (typeof window === 'undefined') {
    throw new Error('createMcpLogger() requires a browser environment')
  }

  const endpoint = options.endpoint || window.location.origin + '/push'
  const headers = options.headers || {}
  const baseLevel = options.level || 'info'
  const baseClientId = options.clientId || 'demo-browser'
  const baseSessionId = options.sessionId || 'demo-session'

  const transport = createFetchTransport({ endpoint, headers })

  return function mcpLog(message, overrides = {}) {
    const entry = {
      level: overrides.level || baseLevel,
      message: normalizeMessage(message),
      clientId: overrides.clientId || baseClientId,
      sessionId: overrides.sessionId || baseSessionId,
      timestamp: toISOString(overrides.timestamp || Date.now())
    }

    if (overrides.data) {
      entry.data = overrides.data
    }

    return transport.sendBatch([entry])
  }
}

let transport = null
let currentSession = '.'
let currentClient = '.'

function ensureTransport() {
  if (!transport) {
    transport = createFetchTransport({ endpoint: window.location.origin + '/push' })
  }
  return transport
}

export function mcpLog(message, session = '.', client = '.') {
  if (session && session !== '.') {
    currentSession = session
  }
  if (client && client !== '.') {
    currentClient = client
  }

  const entry = {
    level: 'info',
    message,
    clientId: currentClient,
    sessionId: currentSession,
    timestamp: new Date().toISOString()
  }

  ensureTransport().sendBatch([entry])
}

if (typeof window !== 'undefined') {
  window.mcpLog = mcpLog
}
