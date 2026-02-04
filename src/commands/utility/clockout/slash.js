const { SlashCommandBuilder } = require("discord.js")
const staffPerms = require("../../../utils/staffPerms")
const staffDb = require("../../../core/database/staffTime")
const dmUser = require("../../../utils/dmUser")
const format = require("../../../utils/timeFormat")

const clockOutEmbed = require("../../../messages/embeds/staffTime.clockout.embed")
const errorEmbed = require("../../../messages/embeds/error.embed")
const COLORS = require("../../../utils/colors")

module.exports = {
  data: new SlashCommandBuilder()
    .setName("clockout")
    .setDescription("Clock out from staff duty"),

  async execute(interaction) {
    const member = interaction.member
    const guildId = interaction.guild.id

    if (!(await staffPerms(guildId, member))) {
      return interaction.editReply({
        embeds: [errorEmbed({
          users: `<@${member.id}>`,
          punishment: "clockout",
          state: "failed",
          reason: "No permission",
          color: COLORS.error
        })]
      })
    }

    const duration = await staffDb.endSession({
      guildId,
      userId: member.id
    })

    if (!duration) {
      return interaction.editReply({
        embeds: [errorEmbed({
          users: `<@${member.id}>`,
          punishment: "clockout",
          state: "failed",
          reason: "Not clocked in",
          color: COLORS.error
        })]
      })
    }

    const embed = clockOutEmbed(format(duration))

    await dmUser(member.user, embed)

    return interaction.editReply({
      embeds: [embed]
    })
  }
}