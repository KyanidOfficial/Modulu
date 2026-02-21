const logServerEvent = require("../../shared/utils/logServerEvent")
const serverLogEmbed = require("../../messages/embeds/serverLog.embed")

module.exports = (client, member) => {
  logServerEvent(
    member.guild,
    serverLogEmbed({
      event: "Member left",
      target: `<@${member.id}>`,
      details: `**ID:** ${member.id}`
    })
  )
}