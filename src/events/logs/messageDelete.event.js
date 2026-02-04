const logChatEvent = require("../../utils/logChatEvent")
const chatLogEmbed = require("../../messages/embeds/chatLog.embed")

const cut = v => v?.length > 1000 ? v.slice(0, 1000) + "…" : v

module.exports = (client, message) => {
  if (!message?.guild) return
  if (!message.author || message.author.bot) return

  const attachments = [...message.attachments.values()]

  logChatEvent(
    message.guild,
    chatLogEmbed({
      action: "Message deleted",
      user: `${message.author.tag} (${message.author.id})`,
      channel: `<#${message.channel.id}>`,
      before: cut(message.content || "No content")
    }).setThumbnail(message.author.displayAvatarURL()),
    attachments
  )
}