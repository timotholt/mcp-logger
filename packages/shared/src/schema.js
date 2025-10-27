import { isValidLogLevel, clampLogLevel } from './logLevels.js'

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]'
}

function ensureString(value, fallback = '') {
  if (typeof value === 'string') {
    return value
  }
  if (value == null) {
    return fallback
  }
  try {
    return String(value)
  } catch (err) {
    return fallback
  }
}

export function validateLogPayload(payload = {}) {
  if (!isPlainObject(payload)) {
    throw new TypeError('Log payload must be an object')
  }

  const result = {
    id: ensureString(payload.id, null),
    timestamp: ensureString(payload.timestamp, null),
    level: clampLogLevel(payload.level),
    message: ensureString(payload.message),
    clientId: ensureString(payload.clientId, null),
    sessionId: ensureString(payload.sessionId, null),
    data: undefined,
    source: ensureString(payload.source, null)
  }

  if (payload.data !== undefined) {
    if (typeof payload.data === 'string') {
      result.data = { message: payload.data }
    } else if (isPlainObject(payload.data) || Array.isArray(payload.data)) {
      result.data = payload.data
    } else {
      result.data = { value: payload.data }
    }
  }

  return result
}

export function validateFetchOptions(options = {}) {
  if (!isPlainObject(options)) {
    throw new TypeError('Fetch options must be an object')
  }

  const levels = Array.isArray(options.levels)
    ? options.levels.filter((level) => isValidLogLevel(level))
    : undefined

  const limit = typeof options.limit === 'number' && options.limit > 0 ? options.limit : undefined

  const since = typeof options.since === 'number' || typeof options.since === 'string' ? options.since : undefined

  const cursor = typeof options.cursor === 'number' ? options.cursor : undefined

  return {
    levels,
    clientId: typeof options.clientId === 'string' ? options.clientId : undefined,
    sessionId: typeof options.sessionId === 'string' ? options.sessionId : undefined,
    limit,
    since,
    cursor
  }
}

export function normalizeTimestamp(value) {
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (typeof value === 'number') {
    return new Date(value).toISOString()
  }
  if (typeof value === 'string') {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString()
    }
  }
  return new Date().toISOString()
}
