// src/events/messageCreate.event.js
const prefixHandler = require("../core/handlers/prefix.handler")
const harmfulLinks = require("./messages/harmfulLinks")
const sbDebug = require("./messages/sbDebug")
const spamProtection = require("./messages/spamProtection")
const giveawayTrigger = require("./messages/giveawayTrigger")
const handleApplicationDm = require("../modules/applications/dm.handler")

const log = (message, meta = {}) => {
  const parts = Object.entries(meta).map(([k, v]) => `${k}=${v}`)
  console.log(`[APPLICATIONS] ${message}${parts.length ? ` ${parts.join(" ")}` : ""}`)
}

module.exports = async (client, message) => {
  if (!message) return

  log("messageCreate event firing", {
    userId: message.author?.id || "unknown",
    channelType: message.channel?.type,
    isDM: Boolean(message.channel?.isDMBased?.())
  })

  if (message.author.bot) return

  // Keep DM routing first so it cannot be gated by guild-only handlers.
  const consumedByApplicationFlow = await handleApplicationDm(message)
  if (consumedByApplicationFlow) return

  if (!message.content && message.attachments.size === 0) return

  await spamProtection(message)
  await sbDebug(message)
  await harmfulLinks(message)
  await giveawayTrigger(message)
  await prefixHandler(client, message)
}