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
    const session = entry.sessionId || this._sessions.currentSession()?.id
    const stored = this._buffer.append({ ...entry, sessionId: session })
    this._sessions.recordEntry(session)
    this.emit('append', stored)
    return stored
  }

  clear() {
    this._buffer.clear()
    const session = this._sessions.startSession('session')
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
    const filterFn = createFilter(filterOptions || {})
    return this._buffer.read({ cursor, limit, filter: filterFn })
  }

  stats() {
    return this._buffer.stats()
  }
}
