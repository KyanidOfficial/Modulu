const serializeError = err => {
  if (!err) return null
  return {
    name: err.name,
    message: err.message,
    stack: err.stack
  }
}

const write = (level, event, payload = {}) => {
  const entry = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...payload
  }
  process.stdout.write(`${JSON.stringify(entry)}\n`)
}

module.exports = {
  info(event, payload) {
    write("info", event, payload)
  },
  warn(event, payload) {
    write("warn", event, payload)
  },
  error(event, payload = {}) {
    write("error", event, {
      ...payload,
      error: serializeError(payload.error)
    })
  }
}
