import { LOG_LEVEL_INDEX } from '@mcp-logger/shared'

export function createFilter({ levels, clientId, sessionId, since }) {
  const levelSet = Array.isArray(levels) && levels.length ? new Set(levels) : null
  const sinceTime = normalizeSince(since)

  return function filter(entry) {
    if (levelSet && !levelSet.has(entry.level)) {
      return false
    }
    if (clientId && entry.clientId !== clientId) {
      return false
    }
    if (sessionId && entry.sessionId !== sessionId) {
      return false
    }
    if (sinceTime && Date.parse(entry.timestamp) < sinceTime) {
      return false
    }
    return true
  }
}

export function normalizeSince(value) {
  if (typeof value === 'number') {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? null : parsed
  }
  return null
}

export function levelAtLeast(level, minimum) {
  if (!LOG_LEVEL_INDEX[level] && LOG_LEVEL_INDEX[level] !== 0) {
    return false
  }
  if (!LOG_LEVEL_INDEX[minimum] && LOG_LEVEL_INDEX[minimum] !== 0) {
    return true
  }
  return LOG_LEVEL_INDEX[level] >= LOG_LEVEL_INDEX[minimum]
}
