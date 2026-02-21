const COMMAND_ENABLED = true
const { SlashCommandBuilder, PermissionsBitField, ChannelType } = require("discord.js")
const embed = require("../../../../messages/embeds/punishment.embed")
const errorEmbed = require("../../../../messages/embeds/error.embed")
const COLORS = require("../../../../shared/utils/colors")
const parse = require("../../../../shared/utils/time")
const { scheduleDeletion } = require("../../../../shared/utils/tempVoice")
const logModerationAction = require("../../../../shared/utils/logModerationAction")

module.exports = {
  COMMAND_ENABLED,
  data: new SlashCommandBuilder()
    .setName("voice-temp")
    .setDescription("Create a temporary voice channel")
    .addStringOption(o =>
      o.setName("name").setDescription("Channel name").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("duration")
        .setDescription("How long the channel should last (e.g., 1h, 30m)")
        .setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName("user_limit").setDescription("User limit")
    ),

  async execute(interaction) {
    const guild = interaction.guild
    if (!guild) return

    const executor = interaction.member
    const name = interaction.options.getString("name")
    const durationInput = interaction.options.getString("duration")
    const userLimit = interaction.options.getInteger("user_limit") || 0

    if (!executor.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
      return interaction.editReply({
        embeds: [
          errorEmbed({
            users: `<@${interaction.user.id}>`,
            punishment: "voice-temp",
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
            punishment: "voice-temp",
            state: "failed",
            reason: "Bot lacks permissions",
            color: COLORS.error
          })
        ]
      })
    }

    const parsed = parse(durationInput)
    if (!parsed || !parsed.ms) {
      return interaction.editReply({
        embeds: [
          errorEmbed({
            users: `<@${interaction.user.id}>`,
            punishment: "voice-temp",
            state: "failed",
            reason: "Invalid duration format",
            color: COLORS.error
          })
        ]
      })
    }

    let channel
    try {
      channel = await guild.channels.create({
        name,
        type: ChannelType.GuildVoice,
        userLimit
      })
    } catch {
      return interaction.editReply({
        embeds: [
          errorEmbed({
            users: `<@${interaction.user.id}>`,
            punishment: "voice-temp",
            state: "failed",
            reason: "Failed to create voice channel",
            color: COLORS.error
          })
        ]
      })
    }

    scheduleDeletion(channel, parsed.ms)

    await logModerationAction({
      guild,
      action: "voice-temp",
      userId: null,
      moderatorId: interaction.user.id,
      reason: `Temporary voice channel created: ${name}`,
      color: COLORS.info,
      metadata: {
        channelId: channel.id,
        durationMs: parsed.ms
      }
    })

    return interaction.editReply({
      embeds: [
        embed({
          users: `<#${channel.id}>`,
          punishment: "voice-temp",
          state: "created",
          reason: `Expires in ${parsed.label}`,
          color: COLORS.success
        })
      ]
    })
  }
}
