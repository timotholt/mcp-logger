'use strict'

export function createQueue(options) {
  var flushInterval = options && options.flushInterval ? options.flushInterval : 1000
  var maxBatchSize = options && options.maxBatchSize ? options.maxBatchSize : 50
  var flushFn = options && options.flush ? options.flush : function noop() {}
  var buffer = []
  var timer = null
  var running = false

  function schedule() {
    if (running || timer) {
      return
    }
    timer = setTimeout(function tick() {
      timer = null
      flush()
    }, flushInterval)
  }

  function flush() {
    if (!buffer.length || running) {
      return
    }
    running = true
    var batch = buffer.splice(0, maxBatchSize)
    var result
    try {
      result = flushFn(batch)
    } catch (err) {
      result = Promise.reject(err)
    }
    if (!result || typeof result.then !== 'function') {
      running = false
      schedule()
      return
    }
    function onDone() {
      running = false
      schedule()
    }

    if (typeof result.then === 'function') {
      result.then(onDone, onDone)
    } else {
      onDone()
    }
  }

  function enqueue(entry) {
    buffer.push(entry)
    if (buffer.length >= maxBatchSize) {
      flush()
    } else {
      schedule()
    }
  }

  function clear() {
    buffer = []
  }

  function stop() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    running = false
  }

  return {
    enqueue: enqueue,
    flush: flush,
    clear: clear,
    stop: stop
  }
}
