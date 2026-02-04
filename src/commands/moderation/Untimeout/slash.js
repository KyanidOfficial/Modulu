const { SlashCommandBuilder, PermissionsBitField } = require("discord.js")
const embed = require("../../../messages/embeds/punishment.embed")
const errorEmbed = require("../../../messages/embeds/error.embed")
const dmUser = require("../../../utils/maybeDM")
const dmEmbed = require("../../../messages/embeds/dmPunishment.embed")
const COLORS = require("../../../utils/colors")
const logAction = require("../../../utils/logAction")
const logEmbed = require("../../../messages/embeds/log.embed")

module.exports = {
  data: new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription("Remove a timeout")
    .addUserOption(o =>
      o.setName("user").setDescription("Target user").setRequired(true)
    ),

  async execute(interaction) {
    const guild = interaction.guild
    if (!guild) {
      throw new Error("No guild context")
    }

    const member = interaction.options.getMember("user")
    const executor = interaction.member

    if (!member) {
      return interaction.editReply({
        embeds: [
          errorEmbed({
            users: "Unknown user",
            punishment: "untimeout",
            state: "failed",
            reason: "Member not found",
            color: COLORS.error
          })
        ]
      })
    }

    if (!executor.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      return interaction.editReply({
        embeds: [
          errorEmbed({
            users: `<@${interaction.user.id}>`,
            punishment: "untimeout",
            state: "failed",
            reason: "Missing permissions",
            color: COLORS.error
          })
        ]
      })
    }

    if (!guild.members.me.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      return interaction.editReply({
        embeds: [
          errorEmbed({
            users: `<@${member.id}>`,
            punishment: "untimeout",
            state: "failed",
            reason: "Bot lacks permissions",
            color: COLORS.error
          })
        ]
      })
    }

    if (member.roles.highest.position >= executor.roles.highest.position) {
      return interaction.editReply({
        embeds: [
          errorEmbed({
            users: `<@${member.id}>`,
            punishment: "untimeout",
            state: "failed",
            reason: "Role hierarchy issue",
            color: COLORS.error
          })
        ]
      })
    }

    try {
      await member.timeout(null)
    } catch {
      return interaction.editReply({
        embeds: [
          errorEmbed({
            users: `<@${member.id}>`,
            punishment: "untimeout",
            state: "failed",
            reason: "Failed to remove timeout",
            color: COLORS.error
          })
        ]
      })
    }

    await logAction(
      guild,
      logEmbed({
        punishment: "untimeout",
        user: `<@${member.id}>`,
        moderator: `<@${interaction.user.id}>`,
        reason: "Manual removal",
        color: COLORS.success
      })
    )

    await dmUser(
      guild.id,
      member.user,
      dmEmbed({
        punishment: "untimeout",
        reason: "Manual removal",
        guild: guild.name,
        color: COLORS.warning
      })
    )

    return interaction.editReply({
      embeds: [
        embed({
          users: `<@${member.id}>`,
          punishment: "untimeout",
          state: "removed",
          reason: "Manual removal",
          color: COLORS.success
        })
      ]
    })
  }
}