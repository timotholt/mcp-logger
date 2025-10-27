'use strict'

const original = {}

export function patchConsole(send) {
  if (original.log) {
    return
  }

  ;['log', 'info', 'warn', 'error', 'debug'].forEach(function wrap(method) {
    original[method] = console[method]
    console[method] = function patchedConsole() {
      const args = Array.prototype.slice.call(arguments)
      try {
        send({ level: method === 'debug' ? 'debug' : method, message: args })
      } catch (err) {
        // ignore
      }
      if (original[method]) {
        original[method].apply(console, args)
      }
    }
  })
}

export function restoreConsole() {
  Object.keys(original).forEach(function restore(method) {
    console[method] = original[method]
  })
}
