const logChatEvent = require("../../shared/utils/logChatEvent")
const chatLogEmbed = require("../../messages/embeds/chatLog.embed")

const cut = v => v?.length > 1000 ? v.slice(0, 1000) + "…" : v

module.exports = (client, oldMsg, newMsg) => {
  if (!oldMsg?.guild) return
  if (!oldMsg.author || oldMsg.author.bot) return
  if (oldMsg.content === newMsg.content) return

  logChatEvent(
    oldMsg.guild,
    chatLogEmbed({
      action: "Message edited",
      user: `${oldMsg.author.tag} (${oldMsg.author.id})`,
      channel: `<#${oldMsg.channel.id}>`,
      before: cut(oldMsg.content || "No content"),
      after: cut(newMsg.content || "No content")
    }).setThumbnail(oldMsg.author.displayAvatarURL())
  )
}