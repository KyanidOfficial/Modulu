const db = require("../core/database")

module.exports = async (guild, embed) => {
  if (!guild) {
    console.log("[MOD LOG] No guild")
    return
  }

  const data = await db.get(guild.id)
  const setup = data?.setup

  if (!setup) {
    console.log("[MOD LOG] No setup")
    return
  }

  const channelId = setup.channels?.logs
  if (!channelId) {
    console.log("[MOD LOG] No moderation log channel set")
    return
  }

  const channel = guild.channels.cache.get(channelId)
  if (!channel) {
    console.log("[MOD LOG] Channel not found:", channelId)
    return
  }

  if (!channel.isTextBased()) {
    console.log("[MOD LOG] Channel not text based")
    return
  }

  try {
    console.log("[MOD LOG] Sending embed")
    await channel.send({ embeds: [embed] })
  } catch (err) {
    console.error("[MOD LOG] Send failed:", err)
  }
}