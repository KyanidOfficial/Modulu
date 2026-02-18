const COMMAND_ENABLED = true
const { SlashCommandBuilder, PermissionsBitField } = require("discord.js")
const embed = require("../../../messages/embeds/punishment.embed")
const errorEmbed = require("../../../messages/embeds/error.embed")
const dmUser = require("../../../utils/maybeDM")
const dmEmbed = require("../../../messages/embeds/dmPunishment.embed")
const COLORS = require("../../../utils/colors")
const logModerationAction = require("../../../utils/logModerationAction")
const { resolveModerationAccess } = require("../../../utils/permissionResolver")
const warningStore = require("../../../modules/automod/warnings.store")

module.exports = {
  COMMAND_ENABLED,
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

    const access = await resolveModerationAccess({
      guildId: guild.id,
      member: executor,
      requiredDiscordPerms: [PermissionsBitField.Flags.ModerateMembers]
    })

    if (!access.allowed) {
      return interaction.editReply({
        embeds: [errorEmbed({
          users: `<@${interaction.user.id}>`,
          punishment: "unwarn",
          state: "failed",
          reason: access.reason,
          moderator: `<@${interaction.user.id}>`,
          color: COLORS.error
        })]
      })
    }

    try {
      const result = await warningStore.revokeWarning({ guildId: guild.id, userId: user.id, warningId: warnId })
      if (!result.ok) {
        const reason = result.reason === "already_revoked"
          ? "Warning already revoked"
          : "Invalid warning ID"

        return interaction.editReply({
          embeds: [errorEmbed({
            users: `<@${user.id}>`,
            punishment: "unwarn",
            state: "failed",
            reason,
            moderator: `<@${interaction.user.id}>`,
            color: COLORS.error
          })]
        })
      }

      const activeWarnings = await warningStore.countWarnings(guild.id, user.id, true)

      await logModerationAction({
        guild,
        action: "unwarn",
        userId: user.id,
        moderatorId: interaction.user.id,
        reason: `Manual removal: ${warnId}`,
        color: COLORS.success,
        metadata: { warningId: warnId, activeWarningCount: activeWarnings }
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
          moderator: `<@${interaction.user.id}>`,
          punishment: "warn",
          state: "revoked",
          reason: `Manual removal: ${warnId}`,
          warningCount: activeWarnings,
          color: COLORS.success
        })]
      })
    } catch (err) {
      console.error("[UNWARN] Failed to revoke warning", err)
      return interaction.editReply({
        embeds: [errorEmbed({
          users: `<@${user.id}>`,
          punishment: "unwarn",
          state: "failed",
          reason: "Failed to revoke warning from persistent storage",
          moderator: `<@${interaction.user.id}>`,
          color: COLORS.error
        })]
      })
    }
  }
}
