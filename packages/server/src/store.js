import { validateLogPayload, validateFetchOptions } from '@mcp-logger/shared'
import { RingBuffer } from './ringBuffer.js'
import { SessionManager } from './sessionManager.js'
import { createFilter } from './filters.js'

export class LogStore {
  constructor({ size = 1000 } = {}) {
    this._buffer = new RingBuffer(size)
    this._sessions = new SessionManager()
    this._listeners = new Set()
  }

  on(event, handler) {
    const listener = { event, handler }
    this._listeners.add(listener)
    return () => {
      this._listeners.delete(listener)
    }
  }

  emit(event, payload) {
    for (const listener of this._listeners) {
      if (listener.event === event) {
        try {
          listener.handler(payload)
        } catch (err) {
          // swallow
        }
      }
    }
  }

  append(entry) {
    const payload = validateLogPayload(entry)
    const session = payload.sessionId || this._sessions.currentSession()?.id
    const stored = this._buffer.append({ ...payload, sessionId: session })
    this._sessions.recordEntry(session)
    this.emit('append', stored)
    return stored
  }

  appendMany(entries) {
    if (!Array.isArray(entries)) {
      return [this.append(entries)]
    }
    return entries.map((entry) => this.append(entry))
  }

  clear(label = 'session') {
    this._buffer.clear()
    const session = this._sessions.startSession(label)
    this.emit('clear', session)
    return session
  }

  startSession(label) {
    const session = this._sessions.startSession(label)
    this.emit('session', session)
    return session
  }

  listSessions() {
    return this._sessions.listSessions()
  }

  read({ cursor, limit, filterOptions }) {
    const options = validateFetchOptions(filterOptions || {})
    const filterFn = createFilter(options)
    const desiredLimit = options.limit || limit || 100
    return this._buffer.read({ cursor, limit: desiredLimit, filter: filterFn })
  }

  stats() {
    return this._buffer.stats()
  }
}
