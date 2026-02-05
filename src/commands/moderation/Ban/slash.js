const COMMAND_ENABLED = true
const { SlashCommandBuilder, PermissionsBitField } = require("discord.js")
const embed = require("../../../messages/embeds/punishment.embed")
const errorEmbed = require("../../../messages/embeds/error.embed")
const dmUser = require("../../../utils/maybeDM")
const dmEmbed = require("../../../messages/embeds/dmPunishment.embed")
const COLORS = require("../../../utils/colors")
const logModerationAction = require("../../../utils/logModerationAction")
const { resolveModerationAccess } = require("../../../utils/permissionResolver")

const PRESET_REASONS = [
  "Cheating",
  "Exploiting",
  "Harassment",
  "Hate speech",
  "Spam",
  "Advertising",
  "Ban evasion",
  "Staff discretion"
]

module.exports = {
  COMMAND_ENABLED,
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a user with advanced options")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User to ban")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("Reason for the ban")
        .setAutocomplete(true)
    )
    .addIntegerOption(o =>
      o.setName("delete_messages")
        .setDescription("Delete recent messages")
        .addChoices(
          { name: "Do not delete", value: 0 },
          { name: "Last 1 day", value: 1 },
          { name: "Last 3 days", value: 3 },
          { name: "Last 7 days", value: 7 }
        )
    )
    .addBooleanOption(o =>
      o.setName("dm")
        .setDescription("Send DM to the user. Default true")
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase()
    const choices = PRESET_REASONS
      .filter(r => r.toLowerCase().includes(focused))
      .slice(0, 25)

    await interaction.respond(
      choices.map(r => ({ name: r, value: r }))
    )
  },

  async execute(interaction) {
    const guild = interaction.guild
    if (!guild) return

    const executor = interaction.member
    const botMember = guild.members.me

    const targetUser = interaction.options.getUser("user")
    const reason =
      interaction.options.getString("reason") ||
      "No reason provided"

    const deleteDays =
      interaction.options.getInteger("delete_messages") ?? 0

    const sendDM =
      interaction.options.getBoolean("dm") !== false

    const replyError = text =>
      interaction.editReply({
        embeds: [
          errorEmbed({
            users: `<@${targetUser.id}>`,
            punishment: "ban",
            state: "failed",
            reason: text,
            color: COLORS.error
          })
        ]
      })

    const access = await resolveModerationAccess({
      guildId: guild.id,
      member: executor,
      requiredDiscordPerms: [PermissionsBitField.Flags.BanMembers]
    })
    if (!access.allowed) {
      return replyError(access.reason)
    }

    if (!botMember.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      return replyError("Bot lacks permissions")
    }

    if (targetUser.id === interaction.user.id) {
      return replyError("You cannot ban yourself")
    }

    if (targetUser.id === botMember.id) {
      return replyError("You cannot ban the bot")
    }

    if (targetUser.id === guild.ownerId) {
      return replyError("You cannot ban the server owner")
    }

    const targetMember = await guild.members.fetch(targetUser.id).catch(() => null)

    if (targetMember) {
      if (targetMember.roles.highest.position >= executor.roles.highest.position) {
        return replyError("Role hierarchy issue")
      }

      if (targetMember.roles.highest.position >= botMember.roles.highest.position) {
        return replyError("Target role is higher than bot role")
      }
    }

    const alreadyBanned = await guild.bans.fetch(targetUser.id).catch(() => null)
    if (alreadyBanned) {
      return replyError("User is already banned")
    }

    try {
      await guild.members.ban(targetUser.id, {
        reason,
        deleteMessageDays: deleteDays
      })
    } catch {
      return replyError("Ban failed")
    }

    await logModerationAction({
      guild,
      action: "ban",
      userId: targetUser.id,
      moderatorId: interaction.user.id,
      reason,
      color: COLORS.error,
      metadata: { deleteDays }
    })

    if (sendDM) {
      await dmUser(
        guild.id,
        targetUser,
        dmEmbed({
          punishment: "ban",
          reason,
          guild: guild.name,
          color: COLORS.warning
        })
      )
    }

    return interaction.editReply({
      embeds: [
        embed({
          users: `<@${targetUser.id}>`,
          punishment: "ban",
          state: "applied",
          reason,
          color: COLORS.success
        })
      ]
    })
  }
}
