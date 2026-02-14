const db = require("../../core/database")

module.exports = {
  async get(guildId, caseId) {
    return db.getCaseById(guildId, caseId)
  },
  async history(guildId, userId, page = 1, pageSize = 5) {
    return db.getCaseHistory(guildId, userId, pageSize, (page - 1) * pageSize)
  }
}
