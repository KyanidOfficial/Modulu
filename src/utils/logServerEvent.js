const db = require("../core/database")

module.exports = async (guild, embed) => {
  if (!guild) {
    console.log("[SERVER LOG] No guild")
    return
  }

  const data = await db.get(guild.id)
  const setup = data?.setup

  if (!setup) {
    console.log("[SERVER LOG] No setup")
    return
  }

  if (!setup.features?.serverLogs) {
    console.log("[SERVER LOG] serverLogs disabled")
    return
  }

  const channelId = setup.channels?.serverLogs
  if (!channelId) {
    console.log("[SERVER LOG] No serverLogs channel set")
    return
  }

  const channel = guild.channels.cache.get(channelId)
  if (!channel) {
    console.log("[SERVER LOG] Channel not found:", channelId)
    return
  }

  if (!channel.isTextBased()) {
    console.log("[SERVER LOG] Channel not text based")
    return
  }

  try {
    console.log("[SERVER LOG] Sending embed")
    await channel.send({ embeds: [embed] })
  } catch (err) {
    console.error("[SERVER LOG] Send failed:", err)
  }
}