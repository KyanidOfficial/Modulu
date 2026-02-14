const db = require("../database")
const dmUser = require("../../utils/maybeDM")
const dmEmbed = require("../../messages/embeds/dmPunishment.embed")
const logAction = require("../../utils/logAction")
const logEmbed = require("../../messages/embeds/log.embed")
const COLORS = require("../../utils/colors")

const actionCooldown = new Map()
const COOLDOWN_MS = 10_000

module.exports.handle = async ({ member, type }) => {
  const guild = member.guild
  const guildId = guild.id
  const userId = member.id
  const key = `${guildId}:${userId}`

  const now = Date.now()
  const last = actionCooldown.get(key)

  if (last && now - last < COOLDOWN_MS) {
    return
  }

  actionCooldown.set(key, now)

  await db.incrementViolation({
    guildId,
    userId,
    type
  })

  const v = await db.getViolation(guildId, userId, type)
  const count = v?.count || 1

  if (count === 1) {
    await logAction(
      guild,
      logEmbed({
        punishment: "warning",
        user: `<@${userId}>`,
        moderator: "AutoMod",
        reason: `Spam detected (${type})`,
        color: COLORS.warning
      })
    )

    await dmUser(
      guildId,
      member.user,
      dmEmbed({
        punishment: "warning",
        reason: `Spam detected (${type})`,
        guild: guild.name,
        color: COLORS.warning
      })
    )

    return
  }

  const durationMs = count === 2 ? 60_000 : 300_000
  const expiresAt = Math.floor((Date.now() + durationMs) / 1000)

  await member.timeout(durationMs, "Spam")

  await logAction(
    guild,
    logEmbed({
      punishment: "timeout",
      user: `<@${userId}>`,
      moderator: "AutoMod",
      reason: `Repeated spam (${type})`,
      duration: count === 2 ? "1 minute" : "5 minutes",
      expiresAt,
      color: COLORS.warning
    })
  )

  await dmUser(
    guildId,
    member.user,
    dmEmbed({
      punishment: "timeout",
      expiresAt,
      reason: `Repeated spam (${type})`,
      guild: guild.name,
      color: COLORS.warning
    })
  )

  return "timeout"
}