const COMMAND_ENABLED = true
const { SlashCommandBuilder, PermissionsBitField } = require("discord.js")
const embed = require("../../../messages/embeds/punishment.embed")
const errorEmbed = require("../../../messages/embeds/error.embed")
const COLORS = require("../../../utils/colors")
const logModerationAction = require("../../../utils/logModerationAction")
const { resolveModerationAccess } = require("../../../utils/permissionResolver")
const warningStore = require("../../../modules/warnings/store")

module.exports = {
  COMMAND_ENABLED,
  data: new SlashCommandBuilder()
    .setName("revokeallwarns")
    .setDescription("Clear all active warnings for a user")
    .addUserOption(o =>
      o.setName("user").setDescription("Target user").setRequired(true)
    ),

  async execute(interaction) {
    const guild = interaction.guild
    if (!guild) throw new Error("No guild context")

    const user = interaction.options.getUser("user")

    const access = await resolveModerationAccess({
      guildId: guild.id,
      member: interaction.member,
      requiredDiscordPerms: [PermissionsBitField.Flags.ModerateMembers]
    })

    if (!access.allowed) {
      return interaction.editReply({
        embeds: [errorEmbed({
          users: `<@${interaction.user.id}>`,
          punishment: "clearallwarns",
          state: "failed",
          reason: access.reason,
          moderator: `<@${interaction.user.id}>`,
          color: COLORS.error
        })]
      })
    }

    try {
      const cleared = await warningStore.clearAllWarnings({ guildId: guild.id, userId: user.id })
      const activeWarnings = await warningStore.countWarnings(guild.id, user.id, true)

      await logModerationAction({
        guild,
        action: "clearallwarns",
        userId: user.id,
        moderatorId: interaction.user.id,
        reason: `Cleared ${cleared} active warnings`,
        color: COLORS.success,
        metadata: { clearedWarnings: cleared, activeWarningCount: activeWarnings }
      })

      return interaction.editReply({
        embeds: [embed({
          users: `<@${user.id}>`,
          moderator: `<@${interaction.user.id}>`,
          punishment: "clearallwarns",
          state: "applied",
          reason: `Cleared warnings: ${cleared}`,
          warningCount: activeWarnings,
          color: COLORS.success
        })]
      })
    } catch (err) {
      console.error("[CLEARALLWARNS] Failed to clear warnings", err)
      return interaction.editReply({
        embeds: [errorEmbed({
          users: `<@${user.id}>`,
          punishment: "clearallwarns",
          moderatorId: interaction.user.id,
          state: "failed",
          reason: "Failed to clear warnings from persistent storage",
          moderator: `<@${interaction.user.id}>`,
          color: COLORS.error
        })]
      })
    }
  }
}
