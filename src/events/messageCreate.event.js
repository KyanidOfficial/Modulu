const prefixHandler = require("../core/handlers/prefix.handler")
const harmfulLinks = require("./messages/harmfulLinks")
const sbDebug = require("./messages/sbDebug")
const giveawayTrigger = require("./messages/giveawayTrigger")
const handleApplicationDm = require("../modules/applications/dm.handler")
const automod = require("../modules/automod/service")
const { getSimService } = require("../core/sim")

const isDmBasedChannel = channel =>
  Boolean(channel && typeof channel.isDMBased === "function" && channel.isDMBased())

const safeHandlerRun = async handler => {
  try {
    await handler()
  } catch {
  }
}

const buildDelayedPayload = message => {
  const content = message.content ? String(message.content) : ""
  const delayedHeader = `Delayed message from <@${message.author.id}>:`
  const delayedContent = content ? `${delayedHeader}\n${content}` : delayedHeader
  const files = [...message.attachments.values()].map(attachment => ({
    attachment: attachment.url,
    name: attachment.name || undefined
  }))

  const payload = { content: delayedContent }
  if (files.length) payload.files = files
  return payload
}

const scheduleDelayedResend = ({ message, delayMs }) => {
  const payload = buildDelayedPayload(message)

  setTimeout(() => {
    Promise.resolve(
      message.channel?.send?.(payload)
    ).then(() => {
      console.log("[SIM] Message re-sent after delay", {
        guildId: message.guild?.id,
        userId: message.author?.id,
        channelId: message.channel?.id,
        delayMs
      })
    }).catch(() => {})
  }, delayMs)
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

  const sim = getSimService()
  if (sim) await safeHandlerRun(() => sim.handleMessage(message))

  const delayMs = sim?.getMessageDelayMsForUser?.(message.guild.id, message.author.id) || 0
  if (delayMs > 0) {
    await message.delete().catch(() => null)

    console.log("[SIM] Message delay applied", {
      guildId: message.guild?.id,
      userId: message.author?.id,
      channelId: message.channel?.id,
      delayMs
    })

    scheduleDelayedResend({ message, delayMs })
    return
  }

  const automodResult = await automod.handleMessage(message).catch(() => ({ blocked: false }))
  if (automodResult?.blocked) return

  await safeHandlerRun(() => harmfulLinks(message))
  await safeHandlerRun(() => sbDebug(message))
  await safeHandlerRun(() => giveawayTrigger(message))
  await safeHandlerRun(() => prefixHandler(client, message))
}
