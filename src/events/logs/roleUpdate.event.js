const logServerEvent = require("../../utils/logServerEvent")
const serverLogEmbed = require("../../messages/embeds/serverLog.embed")

module.exports = (client, oldRole, newRole) => {
  if (!newRole.guild) return

  if (oldRole.name !== newRole.name) {
    logServerEvent(
      newRole.guild,
      serverLogEmbed({
        event: "Role renamed",
        target: `<@&${newRole.id}>`,
        details: `${oldRole.name} → ${newRole.name}`
      })
    )
  }

  if (oldRole.color !== newRole.color) {
    logServerEvent(
      newRole.guild,
      serverLogEmbed({
        event: "Role color changed",
        target: `<@&${newRole.id}>`,
        details: `#${oldRole.color.toString(16)} → #${newRole.color.toString(16)}`
      })
    )
  }
}