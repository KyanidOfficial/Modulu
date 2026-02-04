const { SlashCommandBuilder, PermissionsBitField } = require("discord.js")
const embed = require("../../../messages/embeds/punishment.embed")
const errorEmbed = require("../../../messages/embeds/error.embed")
const dmUser = require("../../../utils/maybeDM")
const dmEmbed = require("../../../messages/embeds/dmPunishment.embed")
const COLORS = require("../../../utils/colors")
const logModerationAction = require("../../../utils/logModerationAction")
const ensureRole = require("../../../utils/ensureRole")

module.exports = {
  data: new SlashCommandBuilder()
    .setName("quarantine")
    .setDescription("Place a user in quarantine")
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
            punishment: "quarantine",
            state: "failed",
            reason: text,
            color: COLORS.error
          })
        ]
      })

    if (!executor.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      return replyError("Missing permissions")
    }

    if (!guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      return replyError("Bot lacks permissions")
    }

    if (!target) return replyError("Member not found")

    if (target.roles.highest.position >= executor.roles.highest.position) {
      return replyError("Role hierarchy issue")
    }

    if (target.roles.highest.position >= guild.members.me.roles.highest.position) {
      return replyError("Target role is higher than bot role")
    }

    const quarantineRole = await ensureRole({
      guild,
      roleKey: "quarantined",
      roleName: "Quarantined",
      overwrites: {
        SendMessages: false,
        AddReactions: false,
        SendMessagesInThreads: false,
        Speak: false,
        Connect: false
      }
    })

    if (!quarantineRole) return replyError("Unable to set up quarantine role")

    try {
      await target.roles.add(quarantineRole, reason)
    } catch {
      return replyError("Failed to apply quarantine role")
    }

    await logModerationAction({
      guild,
      action: "quarantine",
      userId: target.id,
      moderatorId: interaction.user.id,
      reason,
      color: COLORS.error
    })

    if (sendDM) {
      await dmUser(
        guild.id,
        target.user,
        dmEmbed({
          punishment: "quarantine",
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
          punishment: "quarantine",
          state: "applied",
          reason,
          color: COLORS.success
        })
      ]
    })
  }
}
