import { normalizeTimestamp } from '@mcp-logger/shared'

export class RingBuffer {
  constructor(size = 1000) {
    this._size = Math.max(1, size)
    this._entries = new Array(this._size)
    this._head = 0
    this._count = 0
    this._sequence = 0
    this._dropped = 0
  }

  append(entry) {
    const sequence = this._nextSequence()
    const normalized = {
      ...entry,
      sequence,
      timestamp: normalizeTimestamp(entry.timestamp),
      id: entry.id || `log-${sequence}`
    }

    if (this._count < this._size) {
      this._entries[(this._head + this._count) % this._size] = normalized
      this._count += 1
    } else {
      this._entries[this._head] = normalized
      this._head = (this._head + 1) % this._size
      this._dropped += 1
    }

    return normalized
  }

  clear() {
    this._entries = new Array(this._size)
    this._head = 0
    this._count = 0
    this._dropped = 0
  }

  read({ cursor = 0, limit = 100, filter = () => true } = {}) {
    if (limit <= 0) {
      return { entries: [], nextCursor: cursor }
    }

    const startSeq = Math.max(cursor, this._sequence - this._count)
    const entries = []
    let nextCursor = this._sequence

    for (let i = 0; i < this._count; i += 1) {
      const index = (this._head + i) % this._size
      const entry = this._entries[index]
      if (!entry || entry.sequence < startSeq) {
        continue
      }
      if (filter(entry)) {
        entries.push(entry)
        if (entries.length >= limit) {
          nextCursor = entry.sequence + 1
          break
        }
      }
      nextCursor = entry.sequence + 1
    }

    return { entries, nextCursor }
  }

  stats() {
    return {
      size: this._size,
      count: this._count,
      dropped: this._dropped,
      sequence: this._sequence
    }
  }

  _nextSequence() {
    this._sequence = (this._sequence + 1) >>> 0
    return this._sequence
  }
}
