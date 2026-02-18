const prefixHandler = require("../core/handlers/prefix.handler")
const harmfulLinks = require("./messages/harmfulLinks")
const sbDebug = require("./messages/sbDebug")
const giveawayTrigger = require("./messages/giveawayTrigger")
const handleApplicationDm = require("../modules/applications/dm.handler")
const automod = require("../modules/automod/service")

const isDmBasedChannel = channel =>
  Boolean(channel && typeof channel.isDMBased === "function" && channel.isDMBased())

const safeHandlerRun = async handler => {
  try {
    await handler()
  } catch {
    // keep messageCreate stable under handler failure
  }
}

module.exports = async (client, message) => {
  if (!message || message.author?.bot) return

  const isDM = isDmBasedChannel(message.channel)

  if (isDM) {
    const consumedByApplicationFlow = await handleApplicationDm(message).catch(() => false)
    if (consumedByApplicationFlow) return
    return
  }

  if (!message.content && message.attachments.size === 0) return

  const automodResult = await automod.handleMessage(message).catch(() => ({ blocked: false }))
  if (automodResult?.blocked) return

  await safeHandlerRun(() => harmfulLinks(message))
  await safeHandlerRun(() => sbDebug(message))
  await safeHandlerRun(() => giveawayTrigger(message))
  await safeHandlerRun(() => prefixHandler(client, message))
}
