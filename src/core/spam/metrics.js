const emojiRegex = /<a?:\w+:\d+>|[\p{Emoji}]/gu

const WINDOW_MS = 5000
const cache = new Map()

module.exports.check = (message, raid) => {
  const key = `${message.guild.id}:${message.author.id}`
  const now = Date.now()

  if (!cache.has(key)) {
    cache.set(key, {
      messages: [],
      hashes: new Map()
    })
  }

  const data = cache.get(key)

  data.messages.push(message)
  data.messages = data.messages.filter(
    m => now - m.createdTimestamp < WINDOW_MS
  )

  const content = message.content || ""
  const hash = content.toLowerCase().trim()

  if (hash) {
    data.hashes.set(hash, (data.hashes.get(hash) || 0) + 1)
  }

  const mentions =
    message.mentions.users.size +
    message.mentions.roles.size

  const emojis = (content.match(emojiRegex) || []).length
  const links = (content.match(/https?:\/\//gi) || []).length

  const attachmentMessages =
    data.messages.filter(m => m.attachments?.size > 0)

  console.log("[SPAM DEBUG]", {
    user: message.author.id,
    totalWindowMessages: data.messages.length,
    attachmentsThisMessage: message.attachments?.size,
    attachmentMessagesInWindow: attachmentMessages.length,
    raid
  })

  const limits = {
    attachments: raid ? 2 : 3,
    links: raid ? 1 : 3,
    mentions: raid ? 3 : 5,
    duplicate: 3,
    rate: raid ? 3 : 5
  }

  if (attachmentMessages.length >= limits.attachments) {
    console.log("[SPAM DEBUG] attachment_spam triggered")
    return {
      type: "attachment_spam",
      messages: attachmentMessages
    }
  }

  if (links >= limits.links) {
    return {
      type: "link_spam",
      messages: [message]
    }
  }

  if (mentions >= limits.mentions) {
    return {
      type: "mention_spam",
      messages: [message]
    }
  }

  if (hash && data.hashes.get(hash) >= limits.duplicate) {
    return {
      type: "text_duplicate",
      messages: data.messages.filter(
        m => m.content?.toLowerCase().trim() === hash
      )
    }
  }

  if (data.messages.length >= limits.rate) {
    return {
      type: "text_rate",
      messages: data.messages
    }
  }

  return null
}