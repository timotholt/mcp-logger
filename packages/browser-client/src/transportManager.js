'use strict'

import { createQueue } from './queue.js'
import { createFetchTransport } from './transportFetch.js'
import { createWebSocketTransport } from './transportWebSocket.js'

export function createTransportManager(options) {
  var endpoint = options.endpoint
  var wsUrl = options.wsUrl
  var headers = options.headers || {}
  var levels = options.levels
  var clientId = options.clientId
  var sessionId = options.sessionId

  var useWebSocket = options.useWebSocket !== false
  var websocket = useWebSocket ? createWebSocketTransport({ url: wsUrl }) : null
  var fetchTransport = createFetchTransport({ endpoint: endpoint, headers: headers })

  var queue = createQueue({ flushInterval: 500, maxBatchSize: 25, flush: flushBatch })

  function formatEntry(entry) {
    var message = entry.message
    if (Array.isArray(message)) {
      message = message.map(function (item) {
        if (typeof item === 'string') return item
        try {
          return JSON.stringify(item)
        } catch (err) {
          return String(item)
        }
      }).join(' ')
    }
    return {
      level: entry.level,
      message: message,
      clientId: clientId,
      sessionId: sessionId,
      timestamp: entry.timestamp || new Date().toISOString(),
      data: entry.data
    }
  }

  function shouldSend(level) {
    if (!levels || !levels.length) return true
    return levels.indexOf(level) !== -1
  }

  function send(entry) {
    if (!shouldSend(entry.level)) {
      return
    }
    queue.enqueue(formatEntry(entry))
  }

  function flushBatch(batch) {
    if (websocket) {
      websocket.connect().then(function (state) {
        if (state.ready) {
          websocket.sendBatch(batch)
        } else {
          fetchTransport.sendBatch(batch)
        }
      })
      return Promise.resolve()
    }

    return fetchTransport.sendBatch(batch)
  }

  function setSession(id) {
    sessionId = id
  }

  function dispose() {
    queue.stop()
    if (websocket) {
      websocket.close()
    }
  }

  return {
    send: send,
    setSession: setSession,
    dispose: dispose
  }
}
