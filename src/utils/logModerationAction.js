const db = require("../core/database")
const logAction = require("./logAction")
const logEmbed = require("../messages/embeds/log.embed")
const COLORS = require("./colors")

module.exports = async ({
  guild,
  action,
  userId,
  moderatorId,
  reason,
  duration,
  expiresAt,
  metadata,
  color
}) => {
  if (!guild) return null

  let caseId = null
  try {
    caseId = await db.addModerationLog({
      guildId: guild.id,
      action,
      userId,
      moderatorId,
      reason,
      metadata
    })
  } catch (err) {
    console.error("[MOD LOG] Failed to store moderation log", err)
  }

  await logAction(
    guild,
    logEmbed({
      punishment: action,
      user: userId ? `<@${userId}>` : "N/A",
      moderator: moderatorId ? `<@${moderatorId}>` : "N/A",
      reason,
      duration,
      expiresAt,
      caseId,
      color: color || COLORS.warning
    })
  )

  return caseId
}
