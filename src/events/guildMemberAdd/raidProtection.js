const raidState = require("../../core/raid/raidState")
const db = require("../../core/database")
const raidEmbed = require("../../messages/embeds/raid.embed")
const logServerEvent = require("../../utils/logServerEvent")

module.exports = async member => {
  const guildId = member.guild.id

  await db.addJoin(guildId)

  const joins = await db.countRecentJoins(guildId, 30)

  if (joins < 8) return

  await raidState.activate(guildId, joins)

  logServerEvent(
    member.guild,
    raidEmbed({
      state: "started",
      joins
    })
  )
}