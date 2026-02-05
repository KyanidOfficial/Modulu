const { SlashCommandBuilder, PermissionsBitField, ChannelType } = require("discord.js")
const embed = require("../../../messages/embeds/punishment.embed")
const errorEmbed = require("../../../messages/embeds/error.embed")
const COLORS = require("../../../utils/colors")
const logModerationAction = require("../../../utils/logModerationAction")

const applyLockdown = async (channels, enabled) => {
  const permissions = { SendMessages: !enabled, AddReactions: !enabled, SendMessagesInThreads: !enabled }
  const failures = []

  for (const channel of channels) {
    try {
      await channel.permissionOverwrites.edit(channel.guild.roles.everyone, permissions)
    } catch {
      failures.push(channel.id)
    }
  }

  return failures
}

module.exports = {
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
        .setDescription("Specific channel to lock/unlock")
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
    const reason = interaction.options.getString("reason") || "No reason provided"
    const mode = interaction.options.getString("mode")
    const targetChannel = interaction.options.getChannel("channel")

    if (!executor.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
      return interaction.editReply({
        embeds: [
          errorEmbed({
            users: `<@${interaction.user.id}>`,
            punishment: "lockdown",
            state: "failed",
            reason: "Missing permissions",
            color: COLORS.error
          })
        ]
      })
    }

    if (!guild.members.me.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
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
      : guild.channels.cache.filter(c =>
        c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement
      ).values()

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
