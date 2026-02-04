const logServerEvent = require("../../utils/logServerEvent")
const serverLogEmbed = require("../../messages/embeds/serverLog.embed")

module.exports = (client, channel) => {
  if (!channel?.guild) return

  logServerEvent(
    channel.guild,
    serverLogEmbed({
      event: "Channel created",
      target: `<#${channel.id}>`,
      details: `**Type:** ${channel.type}\n**ID:** ${channel.id}`
    })
  )
}