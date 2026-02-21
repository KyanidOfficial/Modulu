const db = require("../../core/database")
const { AttachmentBuilder } = require("discord.js")

module.exports = async (guild, embed, attachments = []) => {
  if (!guild) {
    console.log("[CHAT LOG] No guild")
    return
  }

  const data = await db.get(guild.id)
  const setup = data?.setup

  if (!setup) {
    console.log("[CHAT LOG] No setup")
    return
  }

  if (!setup.features?.chatLogs) {
    console.log("[CHAT LOG] chatLogs disabled")
    return
  }

  const channelId = setup.channels?.chatLogs
  if (!channelId) {
    console.log("[CHAT LOG] No chatLogs channel set")
    return
  }

  const channel = guild.channels.cache.get(channelId)
  if (!channel) {
    console.log("[CHAT LOG] Channel not found:", channelId)
    return
  }

  if (!channel.isTextBased()) {
    console.log("[CHAT LOG] Channel not text based")
    return
  }

  const files = []
  const missing = []

  for (const a of attachments) {
    if (!a?.url) continue

    try {
      files.push(new AttachmentBuilder(a.url, {
        name: a.name || "attachment"
      }))
    } catch {
      missing.push(a.url)
    }
  }

  if (missing.length) {
    embed.addFields({
      name: "Deleted Attachments",
      value: missing.join("\n").slice(0, 1024)
    })
  }

  try {
    console.log("[CHAT LOG] Sending embed")
    await channel.send({
      embeds: [embed],
      files
    })
  } catch (err) {
    console.error("[CHAT LOG] Send failed:", err)
  }
}