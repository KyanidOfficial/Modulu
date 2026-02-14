const prefixHandler = require("../core/handlers/prefix.handler")
const harmfulLinks = require("./messages/harmfulLinks")
const sbDebug = require("./messages/sbDebug")
const spamProtection = require("./messages/spamProtection")
const giveawayTrigger = require("./messages/giveawayTrigger")
const handleApplicationDm = require("../modules/applications/dm.handler")
const automod = require("../modules/automod")
const { handleClientError } = require("../core/observability/errorHandler")

const isDmBasedChannel = channel =>
  Boolean(channel && typeof channel.isDMBased === "function" && channel.isDMBased())

module.exports = async (client, message) => {
  try {
    if (!message) return
    if (message.author?.bot) return

    const isDM = isDmBasedChannel(message.channel)

    if (isDM) {
      const consumedByApplicationFlow = await handleApplicationDm(message)
      if (consumedByApplicationFlow) return
      return
    }

    if (!message.content && message.attachments.size === 0) return

    await spamProtection(message)
    await sbDebug(message)
    await harmfulLinks(message)
    await giveawayTrigger(message)
    await automod.handleMessage(message)
    await prefixHandler(client, message)
  } catch (error) {
    handleClientError({
      error,
      event: "messageCreate",
      context: {
        guildId: message?.guild?.id,
        channelId: message?.channel?.id,
        messageId: message?.id,
        authorId: message?.author?.id
      }
    })
  }
}
