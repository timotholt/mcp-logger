const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal']

export const LOG_LEVEL_INDEX = LOG_LEVELS.reduce((acc, level, index) => {
  acc[level] = index
  return acc
}, {})

export function isValidLogLevel(level) {
  return typeof level === 'string' && Object.prototype.hasOwnProperty.call(LOG_LEVEL_INDEX, level)
}

export function compareLevels(levelA, levelB) {
  if (!isValidLogLevel(levelA) || !isValidLogLevel(levelB)) {
    return 0
  }
  return LOG_LEVEL_INDEX[levelA] - LOG_LEVEL_INDEX[levelB]
}

export function levelEnabled(currentLevel, targetLevel) {
  if (!isValidLogLevel(currentLevel) || !isValidLogLevel(targetLevel)) {
    return false
  }
  return LOG_LEVEL_INDEX[targetLevel] >= LOG_LEVEL_INDEX[currentLevel]
}

export function clampLogLevel(level) {
  if (isValidLogLevel(level)) {
    return level
  }
  return 'info'
}

export const LOG_LEVELS_LIST = LOG_LEVELS.slice()
