module.exports = {
  info(event, context = {}) {
    console.log(JSON.stringify({ level: "info", event, ...context }))
  },
  warn(event, context = {}) {
    console.warn(JSON.stringify({ level: "warn", event, ...context }))
  },
  error(event, context = {}) {
    console.error(JSON.stringify({ level: "error", event, ...context }))
  }
}
