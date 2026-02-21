const db = require("../../core/database")

module.exports = async (guild, embed) => {
  if (!guild) return { ok: false, reason: "no_guild" }

  let data
  try {
    data = await db.get(guild.id)
  } catch (err) {
    console.error("[MOD LOG] Failed to load guild setup", err)
    return { ok: false, reason: "db_error" }
  }

  const setup = data?.setup
  const channelId = setup?.channels?.logs
  if (!channelId) return { ok: false, reason: "no_log_channel" }

  const channel = guild.channels.cache.get(channelId)
  if (!channel || !channel.isTextBased()) {
    return { ok: false, reason: "invalid_log_channel" }
  }

  try {
    await channel.send({ embeds: [embed] })
    return { ok: true }
  } catch (err) {
    console.error("[MOD LOG] Send failed", err)
    return { ok: false, reason: "send_failed" }
  }
}
