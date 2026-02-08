const { clearAllSessions } = require("../modules/applications/modalApply.store")

module.exports = client => {
  clearAllSessions()
  console.log(`Logged in as ${client.user.tag}`)
  console.log("successfully finished startup")
}
