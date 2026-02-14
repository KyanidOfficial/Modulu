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
const { quarantinedRoles } = require("../../../utils/quarantineState")

module.exports = {
  COMMAND_ENABLED,
  data: new SlashCommandBuilder()
    .setName("unquarantine")
    .setDescription("Remove a user from quarantine")
    .addUserOption(o =>
      o.setName("user").setDescription("Target user").setRequired(true)
    ),

  async execute(interaction) {
    // HARD FIX: guarantee response window
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply()
    }

    const guild = interaction.guild
    if (!guild) return

    const executor = interaction.member
    const botMember = guild.members.me
    const target = interaction.options.getMember("user")

    const replyError = text =>
      interaction.editReply({
        embeds: [
          errorEmbed({
            users: target ? `<@${target.id}>` : "Unknown",
            punishment: "unquarantine",
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

    if (!access.allowed) return replyError(access.reason)

    if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      return replyError("Bot lacks permissions")
    }

    if (!target) return replyError("Member not found")

    const quarantineRole = await ensureRole({
      guild,
      roleKey: "quarantined",
      roleName: "Quarantined"
    })

    if (!quarantineRole) return replyError("Quarantine role not found")

    if (!target.roles.cache.has(quarantineRole.id)) {
      return replyError("User is not quarantined")
    }

    const key = `${guild.id}:${target.id}`
    const previousRoles = quarantinedRoles.get(key)

    try {
      await target.roles.remove(quarantineRole, "Manual unquarantine")

      if (Array.isArray(previousRoles) && previousRoles.length) {
        await target.roles.add(previousRoles, "Restore roles after quarantine")
      }

      quarantinedRoles.delete(key)
    } catch {
      return replyError("Failed to restore user roles")
    }

    await logModerationAction({
      guild,
      action: "unquarantine",
      userId: target.id,
      moderatorId: interaction.user.id,
      reason: "Manual removal",
      color: COLORS.success
    })

    const dm = dmEmbed({
      punishment: "unquarantine",
      reason: "Manual removal",
      guild: guild.name,
      color: COLORS.success
    })

    if (dm) {
      await dmUser(guild.id, target.user, dm)
    }

    return interaction.editReply({
      embeds: [
        embed({
          users: `<@${target.id}>`,
          punishment: "unquarantine",
          state: "removed",
          reason: "Manual removal",
          color: COLORS.success
        })
      ]
    })
  }
}