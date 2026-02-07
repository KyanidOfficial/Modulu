const COMMAND_ENABLED = true
const { SlashCommandBuilder, PermissionsBitField } = require("discord.js")
const embed = require("../../../messages/embeds/punishment.embed")
const errorEmbed = require("../../../messages/embeds/error.embed")
const COLORS = require("../../../utils/colors")
const logModerationAction = require("../../../utils/logModerationAction")
const { resolveModerationAccess } = require("../../../utils/permissionResolver")

module.exports = {
  COMMAND_ENABLED,
  data: new SlashCommandBuilder()
    .setName("voicemute")
    .setDescription("Server mute or unmute a user in voice")
    .addUserOption(o =>
      o.setName("user").setDescription("Target user").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("mode")
        .setDescription("Mute or unmute")
        .addChoices(
          { name: "Mute", value: "on" },
          { name: "Unmute", value: "off" }
        )
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("Reason")
    ),

  async execute(interaction) {
    const guild = interaction.guild
    if (!guild) return

    const executor = interaction.member
    const botMember = guild.members.me
    const target = interaction.options.getMember("user")
    const mode = interaction.options.getString("mode")
    const reason = interaction.options.getString("reason") || "No reason provided"

    const replyError = text =>
      interaction.editReply({
        embeds: [
          errorEmbed({
            users: target ? `<@${target.id}>` : "Unknown",
            punishment: "voicemute",
            state: "failed",
            reason: text,
            color: COLORS.error
          })
        ]
      })

    const access = await resolveModerationAccess({
      guildId: guild.id,
      member: executor,
      requiredDiscordPerms: [PermissionsBitField.Flags.MuteMembers]
    })

    if (!access.allowed) {
      return replyError(access.reason)
    }

    if (!botMember.permissions.has(PermissionsBitField.Flags.MuteMembers)) {
      return replyError("Bot lacks permissions")
    }

    if (!target) return replyError("Member not found")

    if (!target.voice?.channel) {
      return replyError("User is not in a voice channel")
    }

    const enabled = mode === "on"

    try {
      await target.voice.setMute(enabled, reason)
    } catch {
      return replyError("Failed to update voice mute state")
    }

    await logModerationAction({
      guild,
      action: enabled ? "voicemute" : "voiceunmute",
      userId: target.id,
      moderatorId: interaction.user.id,
      reason,
      color: enabled ? COLORS.warning : COLORS.success,
      metadata: {
        channelId: target.voice.channel.id
      }
    })

    return interaction.editReply({
      embeds: [
        embed({
          users: `<@${target.id}>`,
          punishment: enabled ? "voicemute" : "voiceunmute",
          state: "completed",
          reason,
          color: enabled ? COLORS.warning : COLORS.success
        })
      ]
    })
  }
}