'use strict'

function hasFetch() {
  return typeof window !== 'undefined' && typeof window.fetch === 'function'
}

function hasXMLHttpRequest() {
  return typeof window !== 'undefined' && typeof window.XMLHttpRequest === 'function'
}

export function createFetchTransport(options) {
  var endpoint = options.endpoint
  var headers = options.headers || {}

  function sendBatch(batch) {
    if (!batch || !batch.length) {
      return Promise.resolve()
    }

    if (hasFetch()) {
      return window.fetch(endpoint, {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
        body: JSON.stringify(batch)
      })
    }

    if (hasXMLHttpRequest()) {
      return new Promise(function (resolve, reject) {
        var xhr = new XMLHttpRequest()
        xhr.open('POST', endpoint)
        Object.keys(headers).forEach(function (key) {
          xhr.setRequestHeader(key, headers[key])
        })
        xhr.setRequestHeader('Content-Type', 'application/json')
        xhr.onreadystatechange = function () {
          if (xhr.readyState === 4) {
            resolve()
          }
        }
        xhr.onerror = reject
        xhr.send(JSON.stringify(batch))
      })
    }

    return Promise.resolve()
  }

  return {
    sendBatch: sendBatch
  }
}
