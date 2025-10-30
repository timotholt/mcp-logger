'use strict'

const fetchFn = typeof fetch === 'function' ? fetch : null

if (!fetchFn) {
  throw new Error('Global fetch is not available. Run this demo with Node 18 or newer.')
}

const LOG_ENDPOINT = process.env.LOG_ENDPOINT || 'http://localhost:3333/push'
const CLIENT_ID = process.env.LOG_CLIENT_ID || 'demo-client'
const SESSION_LABEL = process.env.LOG_SESSION_ID || 'demo-session'
const DELAY_MS = Number(process.env.LOG_INTERVAL_MS || 3000)
const DEBUG = process.env.DEMO_DEBUG !== '0'

function zeroPad(value) {
  return value < 10 ? '0' + value : String(value)
}

function formatTimestamp(date) {
  const month = zeroPad(date.getMonth() + 1)
  const day = zeroPad(date.getDate())
  const year = date.getFullYear()
  const hours = zeroPad(date.getHours())
  const minutes = zeroPad(date.getMinutes())
  const seconds = zeroPad(date.getSeconds())
  return month + '/' + day + '/' + year + ' ' + hours + ':' + minutes + ':' + seconds
}

function randomSixDigits() {
  const value = Math.floor(Math.random() * 1000000)
  return String(value + 1000000).slice(1)
}

function createMessage() {
  const now = new Date()
  return (
    'Random message ' +
    randomSixDigits() +
    ' sent at ' +
    formatTimestamp(now)
  )
}

function sendLoop(counter) {
  const message = createMessage()
  const payload = {
    level: 'info',
    message,
    clientId: CLIENT_ID,
    sessionId: SESSION_LABEL,
    timestamp: new Date().toISOString()
  }

  fetchFn(LOG_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
    .then(function (res) {
      if (DEBUG) {
        console.log('[demo] sent #' + counter + ' (' + res.status + '): ' + message)
      }
    })
    .catch(function (err) {
      console.error('[demo] failed to send #' + counter + ':', err)
    })
    .finally(function () {
      setTimeout(function () {
        sendLoop(counter + 1)
      }, DELAY_MS)
    })
}

console.log('[demo] Starting demo client')
console.log('[demo] Endpoint:', LOG_ENDPOINT)
console.log('[demo] Client ID:', CLIENT_ID)
console.log('[demo] Session:', SESSION_LABEL)
console.log('[demo] Interval(ms):', DELAY_MS)

process.on('SIGINT', function () {
  console.log('\n[demo] Stopping demo client')
  process.exit(0)
})

setTimeout(function () {
  sendLoop(1)
}, DELAY_MS)
