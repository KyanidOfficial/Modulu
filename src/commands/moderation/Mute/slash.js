const COMMAND_ENABLED = true
const { SlashCommandBuilder, PermissionsBitField } = require("discord.js")
const embed = require("../../../messages/embeds/punishment.embed")
const errorEmbed = require("../../../messages/embeds/error.embed")
const dmUser = require("../../../utils/maybeDM")
const dmEmbed = require("../../../messages/embeds/dmPunishment.embed")
const COLORS = require("../../../utils/colors")
const logModerationAction = require("../../../utils/logModerationAction")
const ensureRole = require("../../../utils/ensureRole")
const { resolveModerationAccess } = require("../../../utils/permissionResolver")

module.exports = {
  COMMAND_ENABLED,
  data: new SlashCommandBuilder()
    .setName("mute")
    .setDescription("Manually mute a user using a muted role")
    .addUserOption(o =>
      o.setName("user").setDescription("Target user").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("reason").setDescription("Reason")
    )
    .addBooleanOption(o =>
      o.setName("dm").setDescription("Send DM to the user. Default true")
    ),

  async execute(interaction) {
    const guild = interaction.guild
    if (!guild) return

    const executor = interaction.member
    const target = interaction.options.getMember("user")
    const reason = interaction.options.getString("reason") || "No reason provided"
    const sendDM = interaction.options.getBoolean("dm") !== false

    const replyError = text =>
      interaction.editReply({
        embeds: [
          errorEmbed({
            users: target ? `<@${target.id}>` : "Unknown",
            punishment: "mute",
            state: "failed",
            reason: text,
            color: COLORS.error
          })
        ]
      })

    const access = await resolveModerationAccess({
      guildId: guild.id,
      member: executor,
      requiredDiscordPerms: [PermissionsBitField.Flags.ModerateMembers]
    })
    if (!access.allowed) {
      return replyError(access.reason)
    }

    if (!guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      return replyError("Bot lacks permissions")
    }

    if (!target) return replyError("Member not found")

    if (target.id === interaction.user.id) {
      return replyError("You cannot mute yourself")
    }

    if (target.id === guild.members.me.id) {
      return replyError("You cannot mute the bot")
    }

    if (target.roles.highest.position >= executor.roles.highest.position) {
      return replyError("Role hierarchy issue")
    }

    if (target.roles.highest.position >= guild.members.me.roles.highest.position) {
      return replyError("Target role is higher than bot role")
    }

    const mutedRole = await ensureRole({
      guild,
      roleKey: "muted",
      roleName: "Muted",
      overwrites: {
        SendMessages: false,
        AddReactions: false,
        SendMessagesInThreads: false,
        Speak: false,
        Connect: false
      }
    })

    if (!mutedRole) return replyError("Unable to set up muted role")

    if (target.roles.cache.has(mutedRole.id)) {
      return replyError("User is already muted")
    }

    try {
      await target.roles.add(mutedRole, reason)
    } catch {
      return replyError("Failed to apply muted role")
    }

    await logModerationAction({
      guild,
      action: "mute",
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
          punishment: "mute",
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
          punishment: "mute",
          state: "applied",
          reason,
          color: COLORS.success
        })
      ]
    })
  }
}
