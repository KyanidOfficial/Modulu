const logger = require("./logger")

module.exports = async ({ error, context = {}, fallback }) => {
  logger.error("application.error", { ...context, error })
  if (typeof fallback === "function") {
    await fallback()
  }
}
