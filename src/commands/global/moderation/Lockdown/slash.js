const COMMAND_ENABLED = false
const { SlashCommandBuilder, PermissionsBitField, ChannelType } = require("discord.js")
const embed = require("../../../../messages/embeds/punishment.embed")
const errorEmbed = require("../../../../messages/embeds/error.embed")
const COLORS = require("../../../../shared/utils/colors")
const logModerationAction = require("../../../../shared/utils/logModerationAction")
const { resolveModerationAccess } = require("../../../../shared/utils/permissionResolver")

const applyLockdown = async (channels, enabled) => {
  const permissions = {
    SendMessages: !enabled,
    AddReactions: !enabled,
    SendMessagesInThreads: !enabled
  }

  const failures = []

  for (const channel of channels) {
    try {
      await channel.permissionOverwrites.edit(
        channel.guild.roles.everyone,
        permissions
      )
    } catch {
      failures.push(channel.id)
    }
  }

  return failures
}

module.exports = {
  COMMAND_ENABLED,
  data: new SlashCommandBuilder()
    .setName("lockdown")
    .setDescription("Lock or unlock text channels")
    .addStringOption(o =>
      o.setName("mode")
        .setDescription("Enable or disable lockdown")
        .addChoices(
          { name: "Enable", value: "on" },
          { name: "Disable", value: "off" }
        )
        .setRequired(true)
    )
    .addChannelOption(o =>
      o.setName("channel")
        .setDescription("Specific channel to lock or unlock")
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    )
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("Reason for lockdown")
    ),

  async execute(interaction) {
    const guild = interaction.guild
    if (!guild) return

    const executor = interaction.member
    const botMember = guild.members.me
    const mode = interaction.options.getString("mode")
    const targetChannel = interaction.options.getChannel("channel")
    const reason = interaction.options.getString("reason") || "No reason provided"

    const access = await resolveModerationAccess({
      guildId: guild.id,
      member: executor,
      requiredDiscordPerms: [PermissionsBitField.Flags.ManageChannels]
    })

    if (!access.allowed) {
      return interaction.editReply({
        embeds: [
          errorEmbed({
            users: `<@${interaction.user.id}>`,
            punishment: "lockdown",
            state: "failed",
            reason: access.reason,
            color: COLORS.error
          })
        ]
      })
    }

    if (!botMember.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
      return interaction.editReply({
        embeds: [
          errorEmbed({
            users: `<@${interaction.user.id}>`,
            punishment: "lockdown",
            state: "failed",
            reason: "Bot lacks permissions",
            color: COLORS.error
          })
        ]
      })
    }

    const channels = targetChannel
      ? [targetChannel]
      : [...guild.channels.cache.values()].filter(c =>
          c.type === ChannelType.GuildText ||
          c.type === ChannelType.GuildAnnouncement
        )

    const enabled = mode === "on"
    const failures = await applyLockdown(channels, enabled)

    await logModerationAction({
      guild,
      action: enabled ? "lockdown" : "unlockdown",
      userId: null,
      moderatorId: interaction.user.id,
      reason,
      color: enabled ? COLORS.error : COLORS.success,
      metadata: {
        channelId: targetChannel?.id || null,
        failures
      }
    })

    return interaction.editReply({
      embeds: [
        embed({
          users: targetChannel ? `<#${targetChannel.id}>` : "All text channels",
          moderatorId: interaction.user.id,
          punishment: enabled ? "lockdown" : "unlockdown",
          state: "applied",
          reason: failures.length
            ? `Completed with ${failures.length} failures`
            : reason,
          color: enabled ? COLORS.error : COLORS.success
        })
      ]
    })
  }
}