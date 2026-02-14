const COMMAND_ENABLED = true
const { SlashCommandBuilder, PermissionsBitField } = require("discord.js")
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
    .setName("kick")
    .setDescription("Kick a user from the server")
    .addUserOption(o =>
      o.setName("user").setDescription("User to kick").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("reason").setDescription("Reason for the kick")
    )
    .addBooleanOption(o =>
      o.setName("dm").setDescription("Send DM to the user. Default true")
    ),

  async execute(interaction) {
    const guild = interaction.guild
    if (!guild) return

    const executor = interaction.member
    const botMember = guild.members.me
    const target = interaction.options.getMember("user")
    const reason = interaction.options.getString("reason") || "No reason provided"
    const sendDM = interaction.options.getBoolean("dm") !== false

    const replyError = text =>
      interaction.editReply({
        embeds: [
          errorEmbed({
            users: target ? `<@${target.id}>` : "Unknown",
            punishment: "kick",
            state: "failed",
            reason: text,
            color: COLORS.error
          })
        ]
      })

    const access = await resolveModerationAccess({
      guildId: guild.id,
      member: executor,
      requiredDiscordPerms: [PermissionsBitField.Flags.KickMembers]
    })

    if (!access.allowed) {
      return replyError(access.reason)
    }

    if (!botMember.permissions.has(PermissionsBitField.Flags.KickMembers)) {
      return replyError("Bot lacks permissions")
    }

    if (!target) return replyError("Member not found")

    if (target.id === interaction.user.id) {
      return replyError("You cannot kick yourself")
    }

    if (target.id === botMember.id) {
      return replyError("You cannot kick the bot")
    }

    if (target.id === guild.ownerId) {
      return replyError("You cannot kick the server owner")
    }

    if (target.roles.highest.position >= executor.roles.highest.position) {
      return replyError("Role hierarchy issue")
    }

    if (target.roles.highest.position >= botMember.roles.highest.position) {
      return replyError("Target role is higher than bot role")
    }

    try {
      await target.kick(reason)
    } catch {
      return replyError("Kick failed")
    }

    await logModerationAction({
      guild,
      action: "kick",
      userId: target.id,
      moderatorId: interaction.user.id,
      reason,
      color: COLORS.warning
    })

    if (sendDM) {
      await dmUser(
        guild.id,
        target.user,
        dmEmbed({
          punishment: "kick",
          reason,
          guild: guild.name,
          color: COLORS.warning
        })
      )
    }

    return interaction.editReply({
      embeds: [
        embed({
          users: `<@${target.id}>`,
          punishment: "kick",
          state: "applied",
          reason,
          color: COLORS.success
        })
      ]
    })
  }
}