const { clearAllSessions } = require("../modules/applications/session.store")

module.exports = client => {
  clearAllSessions()
  console.log(`[APPLICATIONS] Bot startup complete user=${client.user.id}`)
  console.log("[APPLICATIONS] DM listener registered")
  console.log(`Logged in as ${client.user.tag}`)
  console.log("successfully finished startup")
}
