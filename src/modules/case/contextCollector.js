module.exports = {
  collect({ guild, targetUserId, limit }) {
    const context = []
    const channels = guild.channels.cache.filter(channel => channel.isTextBased())

    for (const channel of channels.values()) {
      const messages = channel.messages?.cache?.filter(m => m.author.id === targetUserId)
      if (!messages || !messages.size) continue
      for (const msg of messages.values()) {
        context.push({
          content: msg.content || "",
          channelId: msg.channel.id,
          messageId: msg.id,
          timestamp: msg.createdTimestamp,
          attachments: msg.attachments.map(a => ({ name: a.name, url: a.url })),
          jumpLink: msg.url
        })
      }
    }

    return context
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit)
  }
}
