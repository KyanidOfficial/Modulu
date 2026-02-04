const logServerEvent = require("../../utils/logServerEvent")
const serverLogEmbed = require("../../messages/embeds/serverLog.embed")

module.exports = (client, oldGuild, newGuild) => {

  /* SERVER NAME */
  if (oldGuild.name !== newGuild.name) {
    logServerEvent(
      newGuild,
      serverLogEmbed({
        event: "Server renamed",
        details: `${oldGuild.name} → ${newGuild.name}`
      })
    )
  }

  /* SERVER ICON */
  if (oldGuild.icon !== newGuild.icon) {
    const newIcon = newGuild.iconURL({ size: 512, extension: "png" })

    logServerEvent(
      newGuild,
      serverLogEmbed({
        event: "Server icon updated",
        details:
          `${newIcon ? "**New icon →**" : "New icon: None"}`
      })
        .setThumbnail(newIcon || null)
    )
  }
}