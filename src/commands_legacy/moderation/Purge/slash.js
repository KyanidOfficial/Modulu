const COMMAND_ENABLED = true
const { SlashCommandBuilder, PermissionsBitField, ChannelType } = require("discord.js")
const embed = require("../../../messages/embeds/punishment.embed")
const errorEmbed = require("../../../messages/embeds/error.embed")
const COLORS = require("../../../utils/colors")
const logModerationAction = require("../../../utils/logModerationAction")
const { resolveModerationAccess } = require("../../../utils/permissionResolver")

module.exports = {
  COMMAND_ENABLED,
  data: new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Mass delete messages from a channel")
    .addIntegerOption(o =>
      o.setName("amount")
        .setDescription("Number of messages to delete (1-100)")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    )
    .addUserOption(o =>
      o.setName("user")
        .setDescription("Only delete messages from this user")
    ),

  async execute(interaction) {
    const guild = interaction.guild
    if (!guild) return

    const executor = interaction.member
    const botMember = guild.members.me
    const channel = interaction.channel
    const amount = interaction.options.getInteger("amount")
    const user = interaction.options.getUser("user")

    if (!channel || channel.type !== ChannelType.GuildText) {
      return interaction.editReply({
        embeds: [
          errorEmbed({
            users: `<@${interaction.user.id}>`,
            punishment: "purge",
            state: "failed",
            reason: "Command must be used in a text channel",
            color: COLORS.error
          })
        ]
      })
    }

    const access = await resolveModerationAccess({
      guildId: guild.id,
      member: executor,
      requiredDiscordPerms: [PermissionsBitField.Flags.ManageMessages]
    })

    if (!access.allowed) {
      return interaction.editReply({
        embeds: [
          errorEmbed({
            users: `<@${interaction.user.id}>`,
            punishment: "purge",
            state: "failed",
            reason: access.reason,
            color: COLORS.error
          })
        ]
      })
    }

    if (!botMember.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return interaction.editReply({
        embeds: [
          errorEmbed({
            users: `<@${interaction.user.id}>`,
            punishment: "purge",
            state: "failed",
            reason: "Bot lacks permissions",
            color: COLORS.error
          })
        ]
      })
    }

    let deletedCount = 0

    try {
      if (user) {
        const fetched = await channel.messages.fetch({ limit: 100 })
        const filtered = fetched.filter(m => m.author.id === user.id).first(amount)
        const deleted = await channel.bulkDelete(filtered, true)
        deletedCount = deleted.size
      } else {
        const deleted = await channel.bulkDelete(amount, true)
        deletedCount = deleted.size
      }
    } catch {
      return interaction.editReply({
        embeds: [
          errorEmbed({
            users: `<@${interaction.user.id}>`,
            punishment: "purge",
            state: "failed",
            reason: "Failed to delete messages. Messages older than 14 days are excluded",
            color: COLORS.error
          })
        ]
      })
    }

    await logModerationAction({
      guild,
      action: "purge",
      userId: user?.id || null,
      moderatorId: interaction.user.id,
      reason: `Purged ${deletedCount} messages in #${channel.name}`,
      color: COLORS.warning,
      metadata: {
        channelId: channel.id,
        amount: deletedCount,
        filteredUserId: user?.id || null
      }
    })

    return interaction.editReply({
      embeds: [
        embed({
          users: user ? `<@${user.id}>` : `<#${channel.id}>`,
          punishment: "purge",
          state: "completed",
          reason: `Deleted ${deletedCount} messages`,
          color: COLORS.success
        })
      ]
    })
  }
}