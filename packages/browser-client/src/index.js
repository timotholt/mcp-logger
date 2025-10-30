'use strict'

import { patchConsole, restoreConsole } from './consolePatch.js'
import { createTransportManager } from './transportManager.js'
export { createMcpLogger, mcpLog } from './demo.js'

var active = null

function ensureManager(options) {
  if (active) {
    return active
  }
  var transport = createTransportManager(options)
  patchConsole(function (entry) {
    transport.send({
      level: entry.level,
      message: entry.message,
      data: entry.data
    })
  })
  active = {
    setSession: transport.setSession,
    dispose: function () {
      restoreConsole()
      transport.dispose()
      active = null
    }
  }
  return active
}

export function attachLogger(options) {
  ensureManager(options || {})
}

export function detachLogger() {
  if (active) {
    active.dispose()
  }
}

export function setSession(id) {
  if (active) {
    active.setSession(id)
  }
}
