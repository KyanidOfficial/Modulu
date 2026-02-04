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
    .setName("unmute")
    .setDescription("Remove a manual mute from a user")
    .addUserOption(o =>
      o.setName("user").setDescription("Target user").setRequired(true)
    ),

  async execute(interaction) {
    const guild = interaction.guild
    if (!guild) return

    const executor = interaction.member
    const target = interaction.options.getMember("user")

    const replyError = text =>
      interaction.editReply({
        embeds: [
          errorEmbed({
            users: target ? `<@${target.id}>` : "Unknown",
            punishment: "unmute",
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

    const mutedRole = await ensureRole({
      guild,
      roleKey: "muted",
      roleName: "Muted"
    })

    if (!mutedRole) return replyError("Muted role not found")

    try {
      await target.roles.remove(mutedRole, "Manual unmute")
    } catch {
      return replyError("Failed to remove muted role")
    }

    await logModerationAction({
      guild,
      action: "unmute",
      userId: target.id,
      moderatorId: interaction.user.id,
      reason: "Manual removal",
      color: COLORS.success
    })

    await dmUser(
      guild.id,
      target.user,
      dmEmbed({
        punishment: "unmute",
        reason: "Manual removal",
        guild: guild.name,
        color: COLORS.success
      })
    )

    return interaction.editReply({
      embeds: [
        embed({
          users: `<@${target.id}>`,
          punishment: "unmute",
          state: "removed",
          reason: "Manual removal",
          color: COLORS.success
        })
      ]
    })
  }
}
