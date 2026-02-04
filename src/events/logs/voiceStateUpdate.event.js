const logServerEvent = require("../../utils/logServerEvent")
const serverLogEmbed = require("../../messages/embeds/serverLog.embed")

module.exports = (client, o, n) => {
  const m = n.member
  if (!m) return

  if (!o.channelId && n.channelId)
    logServerEvent(
      n.guild,
      serverLogEmbed({
        event: "Voice joined",
        target: `<@${m.id}>`,
        details: `<#${n.channelId}>`
      })
    )

  if (o.channelId && !n.channelId)
    logServerEvent(
      n.guild,
      serverLogEmbed({
        event: "Voice left",
        target: `<@${m.id}>`,
        details: `<#${o.channelId}>`
      })
    )
}