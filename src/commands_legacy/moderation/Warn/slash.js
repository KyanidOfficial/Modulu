const COMMAND_ENABLED = true
const { SlashCommandBuilder, PermissionsBitField } = require("discord.js")
const db = require("../../../core/database")
const ids = require("../../../utils/ids")
const embed = require("../../../messages/embeds/punishment.embed")
const errorEmbed = require("../../../messages/embeds/error.embed")
const dmUser = require("../../../utils/maybeDM")
const dmEmbed = require("../../../messages/embeds/dmPunishment.embed")
const COLORS = require("../../../utils/colors")
const logModerationAction = require("../../../utils/logModerationAction")
const { resolveModerationAccess } = require("../../../utils/permissionResolver")
const {
  Permissions,
  ensureActionableTarget,
  ensureBotPermissions,
  ensureModeratable
} = require("../../../core/moderation/permissionGuard")

module.exports = {
  COMMAND_ENABLED,
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn a user")
    .addUserOption(o =>
      o.setName("user").setDescription("Target user").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("reason").setDescription("Reason")
    ),

  async execute(interaction) {
    try {
      const guild = interaction.guild
      if (!guild) throw new Error("No guild context")

      const executor = interaction.member
      const user = interaction.options.getUser("user")
      const member = interaction.options.getMember("user")
      const reason = interaction.options.getString("reason") || "No reason provided"

      if (!member) {
        return interaction.editReply({
          embeds: [errorEmbed({
            users: `<@${user?.id || interaction.user.id}>`,
            punishment: "warn",
            state: "failed",
            reason: "Member not found",
            color: COLORS.error
          })]
        })
      }

      const access = await resolveModerationAccess({
        guildId: guild.id,
        member: executor,
        requiredDiscordPerms: [PermissionsBitField.Flags.ModerateMembers]
      })
      if (!access.allowed) {
        return interaction.editReply({
          embeds: [errorEmbed({
            users: `<@${interaction.user.id}>`,
            punishment: "warn",
            state: "failed",
            reason: access.reason,
            color: COLORS.error
          })]
        })
      }

      const targetCheck = ensureActionableTarget({
        guild,
        executor,
        targetMember: member,
        action: "warn"
      })
      if (!targetCheck.ok) {
        return interaction.editReply({
          embeds: [errorEmbed({
            users: `<@${member.id}>`,
            punishment: "warn",
            state: "failed",
            reason: targetCheck.reason,
            color: COLORS.error
          })]
        })
      }

      const botPermissionCheck = ensureBotPermissions({
        guild,
        targetMember: member,
        requiredPermission: Permissions.ModerateMembers,
        action: "warn"
      })
      if (!botPermissionCheck.ok) {
        return interaction.editReply({
          embeds: [errorEmbed({
            users: `<@${member.id}>`,
            punishment: "warn",
            state: "failed",
            reason: botPermissionCheck.reason,
            color: COLORS.error
          })]
        })
      }

      const manageableCheck = ensureModeratable({
        targetMember: member,
        action: "timeout"
      })
      if (!manageableCheck.ok) {
        return interaction.editReply({
          embeds: [errorEmbed({
            users: `<@${member.id}>`,
            punishment: "warn",
            state: "failed",
            reason: manageableCheck.reason,
            color: COLORS.error
          })]
        })
      }

      const warnId = ids()

      await db.addWarning({
        id: warnId,
        guildId: guild.id,
        userId: user.id,
        moderatorId: interaction.user.id,
        reason,
        active: true,
        createdAt: Date.now()
      })

      await logModerationAction({
        guild,
        action: "warn",
        userId: user.id,
        moderatorId: interaction.user.id,
        reason,
        color: COLORS.warning,
        metadata: { warningId: warnId }
      })

      await dmUser(
        guild.id,
        user,
        dmEmbed({
          punishment: "warn",
          reason,
          guild: guild.name,
          color: COLORS.warning
        })
      )

      return interaction.editReply({
        embeds: [embed({
          users: `<@${user.id}>`,
          punishment: "warn",
          state: "applied",
          reason,
          color: COLORS.warning
        })]
      })
    } catch (error) {
      return interaction.editReply({
        embeds: [errorEmbed({
          users: `<@${interaction.user.id}>`,
          punishment: "warn",
          state: "failed",
          reason: "Command execution failed",
          color: COLORS.error
        })]
      })
    }
  }
}
