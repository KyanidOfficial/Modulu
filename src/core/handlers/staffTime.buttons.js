const staffDb = require("../database/staffTime")
const dmUser = require("../../utils/dmUser")
const format = require("../../utils/timeFormat")

const clockOutEmbed = require("../../messages/embeds/staffTime.clockout.embed")

module.exports = async interaction => {
  if (!interaction.isButton()) return

  const id = interaction.customId
  if (!id.startsWith("staff_active_")) return

  const userId = interaction.user.id
  const active = await staffDb.getAnyActive(userId)
  if (!active) {
    return interaction.update({
      content: "Session not found.",
      components: []
    })
  }

  const guildId = active.guild_id

  if (id === "staff_active_confirm") {
    await staffDb.confirmActive(guildId, userId, Date.now())

    return interaction.update({
      embeds: [
        {
          title: "Activity Confirmed",
          description: "You remain clocked in on staff duty.",
          color: 0x57F287
        }
      ],
      components: []
    })
  }

  if (id === "staff_active_clockout") {
    const duration = await staffDb.endSession({ guildId, userId })
    if (!duration) {
      return interaction.update({
        content: "Session already ended.",
        components: []
      })
    }

    const embed = clockOutEmbed(format(duration))

    await dmUser(interaction.user, embed)

    return interaction.update({
      embeds: [embed],
      components: []
    })
  }
}