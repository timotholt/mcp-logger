export function toCanonicalJSON(value) {
  return JSON.stringify(value, Object.keys(value).sort(), 2)
}

export function toNDJSON(entries) {
  if (!Array.isArray(entries)) {
    return ''
  }

  return entries
    .map((entry) => {
      try {
        return JSON.stringify(entry)
      } catch (err) {
        return ''
      }
    })
    .filter(Boolean)
    .join('\n')
}
