const db = require("../../core/database/applications")

module.exports = {
  async createConfig({ guildId, type, description }) {
    const config = {
      type,
      description,
      questions: [],
      state: "open"
    }

    await db.saveConfig(guildId, type, config)
  },
  

  async listConfigs(guildId) {
    return db.getAllConfigs(guildId)
  },

  async deleteConfig(guildId, type) {
    await db.deleteConfig(guildId, type)
  },
  
  async getConfig(guildId, type) {
    return db.getConfig(guildId, type)
  },

  async updateConfig(guildId, type, config) {
    await db.saveConfig(guildId, type, config)
  }
}