const { SlashCommandBuilder, PermissionsBitField } = require("discord.js")
const embed = require("../../../messages/embeds/punishment.embed")
const errorEmbed = require("../../../messages/embeds/error.embed")
const dmUser = require("../../../utils/maybeDM")
const dmEmbed = require("../../../messages/embeds/dmPunishment.embed")
const COLORS = require("../../../utils/colors")
const logAction = require("../../../utils/logAction")
const logEmbed = require("../../../messages/embeds/log.embed")

module.exports = {
  data: new SlashCommandBuilder()
    .setName("unban")
    .setDescription("Unban a user by ID")
    .addStringOption(o =>
      o.setName("id").setDescription("User ID").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("reason").setDescription("Reason")
    ),

  async execute(interaction) {
    const guild = interaction.guild
    if (!guild) return

    const executor = interaction.member
    const botMember = guild.members.me

    const userId = interaction.options.getString("id")
    const reason = interaction.options.getString("reason") || "Manual unban"

    const replyError = reasonText =>
      interaction.editReply({
        embeds: [
          errorEmbed({
            users: userId,
            punishment: "unban",
            state: "failed",
            reason: reasonText,
            color: COLORS.error
          })
        ]
      })

    if (!/^\d{17,20}$/.test(userId)) {
      return replyError("Invalid user ID")
    }

    if (!executor.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      return replyError("Missing permissions")
    }

    if (!botMember.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      return replyError("Bot lacks permissions")
    }

    let ban
    try {
      ban = await guild.bans.fetch(userId)
    } catch {
      return replyError("User is not banned")
    }

    try {
      await guild.members.unban(userId, reason)
    } catch {
      return replyError("Unban failed")
    }

    await logAction(
      guild,
      logEmbed({
        punishment: "unban",
        user: `<@${userId}>`,
        moderator: `<@${interaction.user.id}>`,
        reason,
        color: COLORS.success
      })
    )

    if (ban?.user) {
      await dmUser(
        guild.id,
        ban.user,
        dmEmbed({
          punishment: "unban",
          reason,
          guild: guild.name,
          color: COLORS.warning
        })
      )
    }

    return interaction.editReply({
      embeds: [
        embed({
          users: userId,
          punishment: "unban",
          state: "removed",
          reason,
          color: COLORS.success
        })
      ]
    })
  }
}