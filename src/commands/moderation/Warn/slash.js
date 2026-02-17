const COMMAND_ENABLED = true
const { SlashCommandBuilder, PermissionsBitField } = require("discord.js")
const embed = require("../../../messages/embeds/punishment.embed")
const errorEmbed = require("../../../messages/embeds/error.embed")
const dmUser = require("../../../utils/maybeDM")
const dmEmbed = require("../../../messages/embeds/dmPunishment.embed")
const COLORS = require("../../../utils/colors")
const logModerationAction = require("../../../utils/logModerationAction")
const { resolveModerationAccess } = require("../../../utils/permissionResolver")
const warningStore = require("../../../modules/warnings/store")

const WARNING_AUTOPUNISH_THRESHOLD = Number.parseInt(process.env.WARNING_AUTOPUNISH_THRESHOLD || "0", 10)
const WARNING_AUTOPUNISH_ACTION = (process.env.WARNING_AUTOPUNISH_ACTION || "timeout").toLowerCase()
const WARNING_AUTOPUNISH_TIMEOUT_MS = Number.parseInt(process.env.WARNING_AUTOPUNISH_TIMEOUT_MS || "3600000", 10)

const formatAutoAction = action => {
  if (action === "ban") return "ban"
  if (action === "kick") return "kick"
  return "timeout"
}

module.exports = {
  COMMAND_ENABLED,
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn a user")
    .addUserOption(o =>
      o.setName("user").setDescription("Target user").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("reason").setDescription("Reason").setRequired(true)
    ),

  async execute(interaction) {
    const guild = interaction.guild
    if (!guild) throw new Error("No guild context")

    const executor = interaction.member
    const user = interaction.options.getUser("user")
    const member = interaction.options.getMember("user")
    const reason = interaction.options.getString("reason")

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
          moderator: `<@${interaction.user.id}>`,
          color: COLORS.error
        })]
      })
    }

    if (!member) {
      return interaction.editReply({
        embeds: [errorEmbed({
          users: `<@${user.id}>`,
          punishment: "warn",
          state: "failed",
          reason: "Member not found",
          moderator: `<@${interaction.user.id}>`,
          color: COLORS.error
        })]
      })
    }

    if (member.roles.highest.position >= executor.roles.highest.position) {
      return interaction.editReply({
        embeds: [errorEmbed({
          users: `<@${user.id}>`,
          punishment: "warn",
          state: "failed",
          reason: "Role hierarchy issue",
          moderator: `<@${interaction.user.id}>`,
          color: COLORS.error
        })]
      })
    }

    try {
      const duplicate = await warningStore.isDuplicateWarning({
        guildId: guild.id,
        userId: user.id,
        moderatorId: interaction.user.id,
        reason
      })

      if (duplicate) {
        return interaction.editReply({
          embeds: [errorEmbed({
            users: `<@${user.id}>`,
            punishment: "warn",
            state: "failed",
            reason: `Duplicate warning blocked (${Math.floor(warningStore.DUPLICATE_WINDOW_MS / 1000)}s cooldown)`,
            moderator: `<@${interaction.user.id}>`,
            color: COLORS.error
          })]
        })
      }

      const warningId = await warningStore.createWarning({
        guildId: guild.id,
        userId: user.id,
        moderatorId: interaction.user.id,
        reason,
        source: "slash_warn"
      })

      const totalWarnings = await warningStore.countWarnings(guild.id, user.id)
      const activeWarnings = await warningStore.countWarnings(guild.id, user.id, true)

      await logModerationAction({
        guild,
        action: "warn",
        userId: user.id,
        moderatorId: interaction.user.id,
        reason,
        color: COLORS.warning,
        metadata: { warningId, warningCount: totalWarnings, activeWarningCount: activeWarnings }
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

      let autoPunishNote = ""
      if (WARNING_AUTOPUNISH_THRESHOLD > 0 && activeWarnings >= WARNING_AUTOPUNISH_THRESHOLD) {
        const autoAction = formatAutoAction(WARNING_AUTOPUNISH_ACTION)
        const autoReason = `[Warn threshold] ${activeWarnings} active warnings reached`

        if (autoAction === "timeout" && member.moderatable) {
          await member.timeout(WARNING_AUTOPUNISH_TIMEOUT_MS, autoReason)
        } else if (autoAction === "kick" && member.kickable) {
          await member.kick(autoReason)
        } else if (autoAction === "ban" && member.bannable) {
          await member.ban({ reason: autoReason, deleteMessageSeconds: 0 })
        }

        autoPunishNote = `\n> **Auto action:** ${autoAction} (${WARNING_AUTOPUNISH_THRESHOLD}+ active warnings)`

        await logModerationAction({
          guild,
          action: autoAction,
          userId: user.id,
          moderatorId: interaction.user.id,
          reason: autoReason,
          color: autoAction === "timeout" ? COLORS.warning : COLORS.error,
          metadata: { warningThreshold: WARNING_AUTOPUNISH_THRESHOLD, activeWarningCount: activeWarnings }
        })
      }

      return interaction.editReply({
        embeds: [embed({
          users: `<@${user.id}>`,
          moderator: `<@${interaction.user.id}>`,
          punishment: "warn",
          state: "applied",
          reason: `${reason}\n> **Warning ID:** ${warningId}${autoPunishNote}`,
          warningCount: totalWarnings,
          color: COLORS.success
        })]
      })
    } catch (err) {
      console.error("[WARN] Failed to persist warning", err)
      return interaction.editReply({
        embeds: [errorEmbed({
          users: `<@${user.id}>`,
          punishment: "warn",
          state: "failed",
          reason: "Failed to save warning in persistent storage",
          moderator: `<@${interaction.user.id}>`,
          color: COLORS.error
        })]
      })
    }
  }
}
