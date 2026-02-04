const { SlashCommandBuilder } = require("discord.js")
const staffPerms = require("../../../utils/staffPerms")
const staffDb = require("../../../core/database/staffTime")
const dmUser = require("../../../utils/dmUser")

const clockInEmbed = require("../../../messages/embeds/staffTime.clockin.embed")
const errorEmbed = require("../../../messages/embeds/error.embed")
const COLORS = require("../../../utils/colors")

module.exports = {
  data: new SlashCommandBuilder()
    .setName("clockin")
    .setDescription("Clock in for staff duty"),

  async execute(interaction) {
    const member = interaction.member
    const guildId = interaction.guild.id

    if (!(await staffPerms(guildId, member))) {
      return interaction.editReply({
        embeds: [errorEmbed({
          users: `<@${member.id}>`,
          punishment: "clockin",
          state: "failed",
          reason: "No permission",
          color: COLORS.error
        })]
      })
    }

    const active = await staffDb.getActive(guildId, member.id)
    if (active) {
      return interaction.editReply({
        embeds: [errorEmbed({
          users: `<@${member.id}>`,
          punishment: "clockin",
          state: "failed",
          reason: "Already clocked in",
          color: COLORS.error
        })]
      })
    }

    await staffDb.startSession({
      guildId,
      userId: member.id,
      startedAt: Date.now()
    })

    const embed = clockInEmbed()

    await dmUser(member.user, embed)

    return interaction.editReply({
      embeds: [embed]
    })
  }
}