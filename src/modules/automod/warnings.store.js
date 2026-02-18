const db = require("../../core/database")

const DUPLICATE_WINDOW_MS = Number.parseInt(process.env.WARNING_DUPLICATE_WINDOW_MS || "10000", 10)

const logError = (message, err, meta = {}) => {
  console.error(`[WARNINGS] ${message}`, {
    ...meta,
    error: err?.message,
    stack: err?.stack
  })
}

const createWarning = async ({ guildId, userId, moderatorId, reason, source = "manual" }) => {
  try {
    return await db.createWarning({ guildId, userId, moderatorId, reason, source })
  } catch (err) {
    logError("createWarning failed", err, { guildId, userId, moderatorId, source })
    throw err
  }
}

const listWarnings = async (guildId, userId) => {
  try {
    return await db.getWarnings(guildId, userId)
  } catch (err) {
    logError("listWarnings failed", err, { guildId, userId })
    throw err
  }
}

const revokeWarning = async ({ guildId, userId, warningId }) => {
  try {
    const warning = await db.getWarningById(guildId, userId, warningId)
    if (!warning) return { ok: false, reason: "not_found" }
    if (!warning.active) return { ok: false, reason: "already_revoked", warning }

    await db.revokeWarning(guildId, userId, warningId)
    return { ok: true, warning }
  } catch (err) {
    logError("revokeWarning failed", err, { guildId, userId, warningId })
    throw err
  }
}

const countWarnings = async (guildId, userId, activeOnly = false) => {
  try {
    return await db.countWarnings(guildId, userId, activeOnly)
  } catch (err) {
    logError("countWarnings failed", err, { guildId, userId, activeOnly })
    throw err
  }
}

const isDuplicateWarning = async ({ guildId, userId, moderatorId, reason }) => {
  try {
    return await db.hasDuplicateWarning({ guildId, userId, moderatorId, reason, withinMs: DUPLICATE_WINDOW_MS })
  } catch (err) {
    logError("isDuplicateWarning failed", err, { guildId, userId, moderatorId })
    throw err
  }
}

module.exports = {
  DUPLICATE_WINDOW_MS,
  createWarning,
  listWarnings,
  revokeWarning,
  countWarnings,
  isDuplicateWarning
}
