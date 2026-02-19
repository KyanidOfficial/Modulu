const { getSimService } = require("../core/sim")
const { clearAllSessions } = require("../modules/applications/modalApply.store")

module.exports = client => {
  clearAllSessions()
  console.log(`Logged in as ${client.user.tag}`)
  getSimService().startApiIfEnabled()
  console.log("successfully finished startup")
}
