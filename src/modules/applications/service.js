const db = require("../../core/database/applications")
const { validateType, validateDescription } = require("./validators")

const normalizeStatus = status => {
  const value = String(status || "pending").toLowerCase()
  if (["pending", "approved", "denied"].includes(value)) return value
  return "pending"
}

module.exports = {
  async createConfig({ guildId, type, description, creatorId }) {
    const normalizedType = validateType(type)
    const safeDescription = validateDescription(description)

    const config = {
      type: normalizedType,
      description: safeDescription,
      creatorId,
      createdAt: new Date().toISOString(),
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
  },

  async listSubmissions(guildId) {
    return db.listSubmissions(guildId)
  },

  async getSubmission(guildId, submissionId) {
    return db.getSubmission(guildId, submissionId)
  },

  async deleteSubmissionsByType(guildId, type) {
    const normalizedType = validateType(type)
    return db.deleteSubmissionsByType(guildId, normalizedType)
  },

  async addStaffNote({ guildId, submissionId, reviewerId, note }) {
    const submission = await db.getSubmission(guildId, submissionId)
    if (!submission || !submission.payload) return false

    const payload = submission.payload
    payload.staffNotes = Array.isArray(payload.staffNotes) ? payload.staffNotes : []
    payload.staffNotes.push({
      reviewerId,
      note,
      at: new Date().toISOString()
    })

    return db.saveSubmission(guildId, submissionId, {
      status: normalizeStatus(submission.status),
      payload
    })
  },

  async decideSubmission({ guildId, submissionId, reviewerId, status, reason }) {
    const submission = await db.getSubmission(guildId, submissionId)
    if (!submission || !submission.payload) return null

    const nextStatus = normalizeStatus(status)
    if (nextStatus === "pending") return null

    const payload = submission.payload
    payload.decision = {
      status: nextStatus,
      reviewerId,
      reason,
      at: new Date().toISOString()
    }

    const saved = await db.saveSubmission(guildId, submissionId, {
      status: nextStatus,
      payload
    })

    if (!saved) return null

    return {
      ...submission,
      status: nextStatus,
      payload
    }
  }
}
