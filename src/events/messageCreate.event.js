const prefixHandler = require("../core/handlers/prefix.handler")
const harmfulLinks = require("./messages/harmfulLinks")
const sbDebug = require("./messages/sbDebug")
const spamProtection = require("./messages/spamProtection")
const giveawayTrigger = require("./messages/giveawayTrigger")
const handleApplicationDm = require("../modules/applications/dm.handler")

module.exports = async (client, message) => {
  if (!message) return
  if (message.author.bot) return

  const consumedByApplicationFlow = await handleApplicationDm(message)
  if (consumedByApplicationFlow) return

  if (!message.content && message.attachments.size === 0) return

  await spamProtection(message)
  await sbDebug(message)
  await harmfulLinks(message)
  await giveawayTrigger(message)
  await prefixHandler(client, message)
}
