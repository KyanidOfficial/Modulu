const db = require("../database")

module.exports = () => {
  setInterval(async () => {
    try {
      await db.cleanupSpamEvents(30)
    } catch (err) {
      console.error("[SPAM CLEANUP] failed", err)
    }
  }, 5 * 60 * 1000)
}