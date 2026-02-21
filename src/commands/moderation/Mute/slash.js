const COMMAND_ENABLED = true
const { SlashCommandBuilder, PermissionsBitField } = require("discord.js")
const parse = require("../../../utils/time")
const embed = require("../../../messages/embeds/punishment.embed")
const errorEmbed = require("../../../messages/embeds/error.embed")
const dmUser = require("../../../utils/maybeDM")
const dmEmbed = require("../../../messages/embeds/dmPunishment.embed")
const COLORS = require("../../../utils/colors")
const logModerationAction = require("../../../utils/logModerationAction")
const { resolveModerationAccess } = require("../../../utils/permissionResolver")

module.exports = {
  COMMAND_ENABLED,
  data: new SlashCommandBuilder()
    .setName("mute")
    .setDescription("mute a user")
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
            punishment: "mute",
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
            punishment: "mute",
            state: "failed",
            reason: "Invalid time format",
            color: COLORS.error
          })
        ]
      })
    }

    const executor = interaction.member

    const access = await resolveModerationAccess({
      guildId: guild.id,
      member: executor,
      requiredDiscordPerms: [PermissionsBitField.Flags.ModerateMembers]
    })
    if (!access.allowed) {
      return interaction.editReply({
        embeds: [
          errorEmbed({
            users: `<@${interaction.user.id}>`,
            punishment: "mute",
            state: "failed",
            reason: access.reason,
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
            punishment: "mute",
            state: "failed",
            reason: "Bot lacks permissions",
            color: COLORS.error
          })
        ]
      })
    }

    if (member.id === interaction.user.id) {
      return interaction.editReply({
        embeds: [
          errorEmbed({
            users: `<@${member.id}>`,
            punishment: "mute",
            state: "failed",
            reason: "You cannot mute yourself",
            color: COLORS.error
          })
        ]
      })
    }

    if (member.id === guild.members.me.id) {
      return interaction.editReply({
        embeds: [
          errorEmbed({
            users: `<@${member.id}>`,
            punishment: "mute",
            state: "failed",
            reason: "You cannot mute the bot",
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
            punishment: "mute",
            state: "failed",
            reason: "Role hierarchy issue",
            color: COLORS.error
          })
        ]
      })
    }

    if (member.isCommunicationDisabled()) {
      return interaction.editReply({
        embeds: [
          errorEmbed({
            users: `<@${member.id}>`,
            punishment: "mute",
            state: "failed",
            reason: "User is already timed out",
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
      action: "mute",
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
        punishment: "mute",
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
          punishment: "mute",
          state: "applied",
          moderatorId: interaction.user.id,
          reason,
          duration: parsed.label,
          expiresAt,
          color: COLORS.success
        })
      ]
    })
  }
}
