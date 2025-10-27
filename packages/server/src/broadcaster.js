export class Broadcaster {
  constructor() {
    this._listeners = new Map()
  }

  on(event, handler) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set())
    }
    const handlers = this._listeners.get(event)
    handlers.add(handler)
    return () => {
      handlers.delete(handler)
    }
  }

  emit(event, payload) {
    const handlers = this._listeners.get(event)
    if (!handlers) {
      return
    }
    handlers.forEach((handler) => {
      try {
        handler(payload)
      } catch (err) {
        // noop
      }
    })
  }
}
