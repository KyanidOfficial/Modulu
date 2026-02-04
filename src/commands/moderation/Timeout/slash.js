const { SlashCommandBuilder, PermissionsBitField } = require("discord.js")
const parse = require("../../../utils/time")
const embed = require("../../../messages/embeds/punishment.embed")
const errorEmbed = require("../../../messages/embeds/error.embed")
const dmUser = require("../../../utils/maybeDM")
const dmEmbed = require("../../../messages/embeds/dmPunishment.embed")
const COLORS = require("../../../utils/colors")
const logModerationAction = require("../../../utils/logModerationAction")

module.exports = {
  data: new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Timeout a user")
    .addUserOption(o =>
      o.setName("user").setDescription("Target user").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("time").setDescription("Duration").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("reason").setDescription("Reason")
    ),

  async execute(interaction) {
    const guild = interaction.guild
    if (!guild) {
      throw new Error("No guild context")
    }

    const member = interaction.options.getMember("user")
    const reason = interaction.options.getString("reason") || "No reason provided"
    const timeInput = interaction.options.getString("time")

    if (!member) {
      return interaction.editReply({
        embeds: [
          errorEmbed({
            users: "Unknown user",
            punishment: "timeout",
            state: "failed",
            reason: "Member not found",
            color: COLORS.error
          })
        ]
      })
    }

    const parsed = parse(timeInput)
    if (!parsed || !parsed.ms) {
      return interaction.editReply({
        embeds: [
          errorEmbed({
            users: `<@${member.id}>`,
            punishment: "timeout",
            state: "failed",
            reason: "Invalid time format",
            color: COLORS.error
          })
        ]
      })
    }

    const executor = interaction.member

    if (!executor.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      return interaction.editReply({
        embeds: [
          errorEmbed({
            users: `<@${interaction.user.id}>`,
            punishment: "timeout",
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
            punishment: "timeout",
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
            punishment: "timeout",
            state: "failed",
            reason: "Role hierarchy issue",
            color: COLORS.error
          })
        ]
      })
    }

    try {
      await member.timeout(parsed.ms, reason)
    } catch (err) {
      throw err
    }

    const expiresAt = Math.floor((Date.now() + parsed.ms) / 1000)

    await logModerationAction({
      guild,
      action: "timeout",
      userId: member.id,
      moderatorId: interaction.user.id,
      reason,
      duration: parsed.label,
      expiresAt,
      color: COLORS.warning
    })

    await dmUser(
      guild.id,
      member.user,
      dmEmbed({
        punishment: "timeout",
        expiresAt,
        reason,
        guild: guild.name,
        color: COLORS.warning
      })
    )

    return interaction.editReply({
      embeds: [
        embed({
          users: `<@${member.id}>`,
          punishment: "timeout",
          state: "applied",
          reason,
          duration: parsed.label,
          expiresAt,
          color: COLORS.success
        })
      ]
    })
  }
}
