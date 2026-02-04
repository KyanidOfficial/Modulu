const logServerEvent = require("../../utils/logServerEvent")
const serverLogEmbed = require("../../messages/embeds/serverLog.embed")

module.exports = (client, channel) => {
  const guild = channel.guild
  if (!guild) return

  logServerEvent(
    guild,
    serverLogEmbed({
      event: "Channel deleted",
      target: channel.name || "Unknown",
      details: `**ID:** ${channel.id}`
    })
  )
}