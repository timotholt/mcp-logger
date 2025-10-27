import dotenv from 'dotenv'

const DEFAULTS = {
  LOG_BUFFER_SIZE: 5000,
  LOG_HTTP_PORT: 0,
  LOG_HTTP_HOST: '0.0.0.0',
  LOG_AUTH_TOKEN: '',
  LOG_BROWSER_TARGET: 'es5',
  LOG_DASHBOARD_DIR: ''
}

dotenv.config()

function parseIntEnv(value, fallback) {
  const numeric = typeof value === 'string' ? parseInt(value, 10) : value
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback
}

export function loadConfig() {
  const httpPort = parseIntEnv(process.env.LOG_HTTP_PORT, DEFAULTS.LOG_HTTP_PORT)

  return {
    bufferSize: parseIntEnv(process.env.LOG_BUFFER_SIZE, DEFAULTS.LOG_BUFFER_SIZE),
    httpPort,
    httpHost: process.env.LOG_HTTP_HOST || DEFAULTS.LOG_HTTP_HOST,
    authToken: process.env.LOG_AUTH_TOKEN || DEFAULTS.LOG_AUTH_TOKEN,
    browserTarget: process.env.LOG_BROWSER_TARGET || DEFAULTS.LOG_BROWSER_TARGET,
    dashboardDir: process.env.LOG_DASHBOARD_DIR || DEFAULTS.LOG_DASHBOARD_DIR
  }
}
