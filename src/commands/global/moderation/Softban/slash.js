const COMMAND_ENABLED = true
const { SlashCommandBuilder, PermissionsBitField } = require("discord.js")
const embed = require("../../../../messages/embeds/punishment.embed")
const errorEmbed = require("../../../../messages/embeds/error.embed")
const dmUser = require("../../../../shared/utils/maybeDM")
const dmEmbed = require("../../../../messages/embeds/dmPunishment.embed")
const COLORS = require("../../../../shared/utils/colors")
const logModerationAction = require("../../../../shared/utils/logModerationAction")
const { resolveModerationAccess } = require("../../../../shared/utils/permissionResolver")

module.exports = {
  COMMAND_ENABLED,
  data: new SlashCommandBuilder()
    .setName("softban")
    .setDescription("Softban a user (ban and unban to delete messages)")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User to softban")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("Reason for the softban")
    )
    .addIntegerOption(o =>
      o.setName("delete_messages")
        .setDescription("Delete recent messages")
        .addChoices(
          { name: "Last 1 day", value: 1 },
          { name: "Last 3 days", value: 3 },
          { name: "Last 7 days", value: 7 }
        )
    )
    .addBooleanOption(o =>
      o.setName("dm")
        .setDescription("Send DM to the user. Default true")
    ),

  async execute(interaction) {
    const guild = interaction.guild
    if (!guild) return

    const executor = interaction.member
    const botMember = guild.members.me
    const targetUser = interaction.options.getUser("user")
    const reason = interaction.options.getString("reason") || "No reason provided"
    const deleteDays = interaction.options.getInteger("delete_messages") ?? 1
    const sendDM = interaction.options.getBoolean("dm") !== false

    if (!targetUser) {
      return interaction.editReply({
        embeds: [
          errorEmbed({
            users: "Unknown",
            punishment: "softban",
            state: "failed",
            reason: "User not found",
            color: COLORS.error
          })
        ]
      })
    }

    const replyError = text =>
      interaction.editReply({
        embeds: [
          errorEmbed({
            users: `<@${targetUser.id}>`,
            punishment: "softban",
            state: "failed",
            reason: text,
            color: COLORS.error
          })
        ]
      })

    const access = await resolveModerationAccess({
      guildId: guild.id,
      member: executor,
      requiredDiscordPerms: [PermissionsBitField.Flags.BanMembers]
    })

    if (!access.allowed) {
      return replyError(access.reason)
    }

    if (!botMember.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      return replyError("Bot lacks permissions")
    }

    if (targetUser.id === interaction.user.id) {
      return replyError("You cannot softban yourself")
    }

    if (targetUser.id === botMember.id) {
      return replyError("You cannot softban the bot")
    }

    if (targetUser.id === guild.ownerId) {
      return replyError("You cannot softban the server owner")
    }

    const targetMember = await guild.members.fetch(targetUser.id).catch(() => null)

    if (targetMember) {
      if (targetMember.roles.highest.position >= executor.roles.highest.position) {
        return replyError("Role hierarchy issue")
      }

      if (targetMember.roles.highest.position >= botMember.roles.highest.position) {
        return replyError("Target role is higher than bot role")
      }
    }

    const alreadyBanned = await guild.bans.fetch(targetUser.id).catch(() => null)
    if (alreadyBanned) {
      return replyError("User is already banned")
    }

    if (sendDM) {
      await dmUser(
        guild.id,
        targetUser,
        dmEmbed({
          punishment: "softban",
          reason,
          guild: guild.name,
          color: COLORS.warning
        })
      )
    }

    try {
      await guild.members.ban(targetUser.id, {
        reason,
        deleteMessageDays: deleteDays
      })
      await guild.members.unban(targetUser.id, "Softban completed")
    } catch {
      return replyError("Softban failed")
    }

    await logModerationAction({
      guild,
      action: "softban",
      userId: targetUser.id,
      moderatorId: interaction.user.id,
      reason,
      color: COLORS.error,
      metadata: { deleteDays }
    })

    return interaction.editReply({
      embeds: [
        embed({
          users: `<@${targetUser.id}>`,
          punishment: "softban",
          moderatorId: interaction.user.id,
          state: "applied",
          reason,
          color: COLORS.success
        })
      ]
    })
  }
}