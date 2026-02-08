const db = require("../../core/database/applications")
const { validateType, validateDescription } = require("./validators")

module.exports = {
  async createConfig({ guildId, type, description }) {
    const normalizedType = validateType(type)
    const safeDescription = validateDescription(description)

    const config = {
      type: normalizedType,
      description: safeDescription,
      questions: [],
      state: "open"
    }

    await db.saveConfig(guildId, normalizedType, config)
    return config
  },

  async listConfigs(guildId) {
    return db.getAllConfigs(guildId)
  },

  async deleteConfig(guildId, type) {
    const normalizedType = validateType(type)
    return db.deleteConfig(guildId, normalizedType)
  },

  async getConfig(guildId, type) {
    const normalizedType = validateType(type)
    return db.getConfig(guildId, normalizedType)
  },

  async updateConfig(guildId, type, config) {
    const normalizedType = validateType(type)
    await db.saveConfig(guildId, normalizedType, config)
  }
}
