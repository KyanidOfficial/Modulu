const prefixHandler = require("../core/handlers/prefix.handler")
const harmfulLinks = require("./messages/harmfulLinks")
const sbDebug = require("./messages/sbDebug")
// const spamProtection = require("./messages/spamProtection")
const giveawayTrigger = require("./messages/giveawayTrigger")
const handleApplicationDm = require("../modules/applications/dm.handler")
const automod = require("../modules/automod/service")

const isDmBasedChannel = channel =>
  Boolean(channel && typeof channel.isDMBased === "function" && channel.isDMBased())

module.exports = async (client, message) => {
  if (!message || message.author?.bot) return

  const isDM = isDmBasedChannel(message.channel)

  // DM routing must happen before guild-only middleware.
  if (isDM) {
    const consumedByApplicationFlow = await handleApplicationDm(message)
    if (consumedByApplicationFlow) return
    return
  }

  if (!message.content && message.attachments.size === 0) return

  try {
    const automodResult = await automod.handleMessage(message)
    if (automodResult?.blocked) return
  } catch (err) {
    console.error("[MESSAGE_CREATE] automod execution failed", err)
  }

  // await spamProtection(message)
  await sbDebug(message)
  await harmfulLinks(message)
  await giveawayTrigger(message)
  await prefixHandler(client, message)
}
