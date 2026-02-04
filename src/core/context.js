const errorEmbed = require("../messages/embeds/error.embed")

module.exports = (source, args = []) => {
  const isSlash =
    source &&
    typeof source.isChatInputCommand === "function" &&
    source.isChatInputCommand()

  return {
    isSlash,
    client: source.client,
    guild: source.guild,
    channel: source.channel,
    member: source.member,
    user: isSlash ? source.user : source.author,
    interaction: isSlash ? source : null,
    message: isSlash ? null : source,
    args,

    async reply(payload) {
      const data = payload?.embeds
        ? payload
        : { embeds: [errorEmbed("Invalid response format")] }

      if (!isSlash) {
        return source.channel.send(data)
      }

      if (source.replied) {
        return source.followUp(data)
      }

      if (source.deferred) {
        return source.editReply(data)
      }

      return source.reply(data)
    }
  }
}