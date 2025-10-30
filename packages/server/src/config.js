import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
import dotenv from 'dotenv'

const require = createRequire(import.meta.url)
const packageJson = require('../package.json')
const PACKAGE_VERSION = packageJson?.version || '0.0.0'

const DEFAULTS = {
  LOG_BUFFER_SIZE: 5000,
  LOG_HTTP_PORT: 0,
  LOG_HTTP_HOST: '0.0.0.0',
  LOG_BROWSER_TARGET: 'es5',
  LOG_DASHBOARD_DIR: '',
  LOG_BUILD_NUMBER: 0
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ENV_PATH = path.resolve(__dirname, '../.env')
const envResult = dotenv.config({ path: ENV_PATH })

export const configMetadata = {
  envFilePath: ENV_PATH,
  envFileLoaded: !envResult.error
}

function parsePositiveIntEnv(value, fallback) {
  const numeric = typeof value === 'string' ? parseInt(value, 10) : value
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback
}

function parseNonNegativeIntEnv(value, fallback) {
  const numeric = typeof value === 'string' ? parseInt(value, 10) : value
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback
}

export function loadConfig() {
  const httpPort = parsePositiveIntEnv(process.env.LOG_HTTP_PORT, DEFAULTS.LOG_HTTP_PORT)
  const dashboardDirRaw = process.env.LOG_DASHBOARD_DIR || DEFAULTS.LOG_DASHBOARD_DIR
  const dashboardDir = dashboardDirRaw
    ? path.resolve(path.dirname(ENV_PATH), dashboardDirRaw)
    : ''

  return {
    bufferSize: parsePositiveIntEnv(process.env.LOG_BUFFER_SIZE, DEFAULTS.LOG_BUFFER_SIZE),
    httpPort,
    httpHost: process.env.LOG_HTTP_HOST || DEFAULTS.LOG_HTTP_HOST,
    browserTarget: process.env.LOG_BROWSER_TARGET || DEFAULTS.LOG_BROWSER_TARGET,
    dashboardDir,
    version: PACKAGE_VERSION,
    buildNumber: parseNonNegativeIntEnv(process.env.LOG_BUILD_NUMBER, DEFAULTS.LOG_BUILD_NUMBER),
    raw: {
      dashboardDir: dashboardDirRaw
    }
  }
}
