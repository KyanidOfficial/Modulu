const prefixHandler = require("../core/handlers/prefix.handler")
const harmfulLinks = require("./messages/harmfulLinks")
const sbDebug = require("./messages/sbDebug")
const giveawayTrigger = require("./messages/giveawayTrigger")
const handleApplicationDm = require("../modules/applications/dm.handler")
const automod = require("../modules/automod/service")

const isDmBasedChannel = channel =>
  Boolean(channel && typeof channel.isDMBased === "function" && channel.isDMBased())

module.exports = async (client, message) => {
  if (!message || message.author?.bot) return

  const isDM = isDmBasedChannel(message.channel)

  if (isDM) {
    const consumedByApplicationFlow = await handleApplicationDm(message)
    if (consumedByApplicationFlow) return
    return
  }

  if (!message.content && message.attachments.size === 0) return

  try {
    const automodResult = await automod.handleMessage(message)
    if (automodResult?.blocked) return
  } catch {
    // keep event flow stable on automod failure
  }

  try {
    await harmfulLinks(message)
  } catch {
    // keep event flow stable on harmful-links failure
  }

  await sbDebug(message)
  await giveawayTrigger(message)
  await prefixHandler(client, message)
}
