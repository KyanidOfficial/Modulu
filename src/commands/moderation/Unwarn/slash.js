const { SlashCommandBuilder, PermissionsBitField } = require("discord.js")
const db = require("../../../core/database")
const embed = require("../../../messages/embeds/punishment.embed")
const errorEmbed = require("../../../messages/embeds/error.embed")
const dmUser = require("../../../utils/maybeDM")
const dmEmbed = require("../../../messages/embeds/dmPunishment.embed")
const COLORS = require("../../../utils/colors")
const logModerationAction = require("../../../utils/logModerationAction")

module.exports = {
  data: new SlashCommandBuilder()
    .setName("unwarn")
    .setDescription("Revoke a warning")
    .addUserOption(o =>
      o.setName("user").setDescription("Target user").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("id").setDescription("Warning ID").setRequired(true)
    ),

  async execute(interaction) {
    const guild = interaction.guild
    if (!guild) throw new Error("No guild context")

    const executor = interaction.member
    const user = interaction.options.getUser("user")
    const warnId = interaction.options.getString("id")

    if (!executor.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      return interaction.editReply({
        embeds: [errorEmbed({
          users: `<@${interaction.user.id}>`,
          punishment: "unwarn",
          state: "failed",
          reason: "Missing permissions",
          color: COLORS.error
        })]
      })
    }

    const warnings = await db.getWarnings(guild.id, user.id)
    const warn = warnings.find(w => w.id === warnId)

    if (!warn) {
      return interaction.editReply({
        embeds: [errorEmbed({
          users: `<@${user.id}>`,
          punishment: "unwarn",
          state: "failed",
          reason: "Invalid warning ID",
          color: COLORS.error
        })]
      })
    }

    if (!warn.active) {
      return interaction.editReply({
        embeds: [errorEmbed({
          users: `<@${user.id}>`,
          punishment: "unwarn",
          state: "failed",
          reason: "Warning already revoked",
          color: COLORS.error
        })]
      })
    }

    await db.revokeWarning(warnId)

    await logModerationAction({
      guild,
      action: "unwarn",
      userId: user.id,
      moderatorId: interaction.user.id,
      reason: `Manual removal: ${warnId}`,
      color: COLORS.success,
      metadata: { warningId: warnId }
    })

    await dmUser(
      guild.id,
      user,
      dmEmbed({
        punishment: "unwarn",
        reason: `Manual removal: ${warnId}`,
        guild: guild.name,
        color: COLORS.success
      })
    )

    return interaction.editReply({
      embeds: [embed({
        users: `<@${user.id}>`,
        punishment: "warn",
        state: "revoked",
        reason: `Manual removal: ${warnId}`,
        color: COLORS.success
      })]
    })
  }
}
