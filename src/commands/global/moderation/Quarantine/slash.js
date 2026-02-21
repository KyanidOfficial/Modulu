const COMMAND_ENABLED = true
const { SlashCommandBuilder, PermissionsBitField } = require("discord.js")
const embed = require("../../../../messages/embeds/punishment.embed")
const errorEmbed = require("../../../../messages/embeds/error.embed")
const dmUser = require("../../../../shared/utils/maybeDM")
const dmEmbed = require("../../../../messages/embeds/dmPunishment.embed")
const COLORS = require("../../../../shared/utils/colors")
const logModerationAction = require("../../../../shared/utils/logModerationAction")
const ensureRole = require("../../../../shared/utils/ensureRole")
const { resolveModerationAccess } = require("../../../../shared/utils/permissionResolver")

const quarantinedRoles = new Map()

module.exports = {
  COMMAND_ENABLED,
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
    const botMember = guild.members.me
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

    if (target.roles.highest.position >= executor.roles.highest.position) {
      return replyError("Role hierarchy issue")
    }

    if (target.roles.highest.position >= botMember.roles.highest.position) {
      return replyError("Target role is higher than bot role")
    }

    const quarantineRole = await ensureRole({
      guild,
      roleKey: "quarantined",
      roleName: "Quarantined",
      overwrites: {
        ViewChannel: false,
        SendMessages: false,
        AddReactions: false,
        SendMessagesInThreads: false,
        Speak: false,
        Connect: false
      }
    })

    if (!quarantineRole) {
      return replyError("Unable to set up quarantine role")
    }

    if (target.roles.cache.has(quarantineRole.id)) {
      return replyError("User is already quarantined")
    }

    const key = `${guild.id}:${target.id}`

    const rolesToRemove = target.roles.cache
      .filter(r => r.id !== guild.id && r.id !== quarantineRole.id)
      .map(r => r.id)

    quarantinedRoles.set(key, rolesToRemove)

    try {
      if (rolesToRemove.length) {
        await target.roles.remove(rolesToRemove, "Quarantine")
      }

      await target.roles.add(quarantineRole, reason)
    } catch {
      quarantinedRoles.delete(key)
      return replyError("Failed to apply quarantine")
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
          moderatorId: interaction.user.id,
          state: "applied",
          reason,
          color: COLORS.success
        })
      ]
    })
  }
}