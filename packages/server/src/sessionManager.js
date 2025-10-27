import { nowIso } from '@mcp-logger/shared'

export class SessionManager {
  constructor() {
    this._sessions = new Map()
    this._currentSessionId = null
    this.startSession('default')
  }

  startSession(label = 'session') {
    const id = `${label}-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 8)}`
    const session = {
      id,
      label,
      startedAt: nowIso(),
      entryCount: 0
    }
    if (this._currentSessionId) {
      const current = this._sessions.get(this._currentSessionId)
      if (current) {
        current.endedAt = nowIso()
      }
    }
    this._sessions.set(id, session)
    this._currentSessionId = id
    return session
  }

  recordEntry(sessionId) {
    const targetId = sessionId || this._currentSessionId
    const session = this._sessions.get(targetId)
    if (session) {
      session.entryCount += 1
    }
  }

  currentSession() {
    return this._sessions.get(this._currentSessionId)
  }

  listSessions() {
    return Array.from(this._sessions.values())
  }
}
