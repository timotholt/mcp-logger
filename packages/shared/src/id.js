let sequence = 0

export function nextSequence() {
  sequence = (sequence + 1) >>> 0
  return sequence
}

export function resetSequence() {
  sequence = 0
}

export function generateId(prefix = 'log') {
  const seq = nextSequence().toString(16)
  const random = Math.random().toString(16).slice(2, 10)
  const time = Date.now().toString(16)
  return `${prefix}-${time}-${random}-${seq}`
}
