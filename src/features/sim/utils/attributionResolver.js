const resolveAttribution = message => ({
  guildId: message?.guild?.id || null,
  channelId: message?.channel?.id || null,
  authorId: message?.author?.id || null
})

module.exports = {
  resolveAttribution
}
