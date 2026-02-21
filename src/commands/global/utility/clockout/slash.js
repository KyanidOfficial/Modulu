const COMMAND_ENABLED = true
const { SlashCommandBuilder } = require("discord.js")
const staffPerms = require("../../../../shared/utils/staffPerms")
const staffDb = require("../../../../core/database/staffTime")
const dmUser = require("../../../../shared/utils/dmUser")
const format = require("../../../../shared/utils/timeFormat")

const clockOutEmbed = require("../../../../messages/embeds/staffTime.clockout.embed")
const errorEmbed = require("../../../../messages/embeds/error.embed")
const COLORS = require("../../../../shared/utils/colors")

module.exports = {
  COMMAND_ENABLED,
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