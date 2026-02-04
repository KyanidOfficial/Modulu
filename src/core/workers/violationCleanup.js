const db = require("../database")

module.exports = () => {
  setInterval(async () => {
    try {
      await db.cleanupViolations(30)
    } catch (err) {
      console.error("[VIOLATION CLEANUP] failed", err)
    }
  }, 5 * 60 * 1000)
}