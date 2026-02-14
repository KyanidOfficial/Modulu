const { SlashCommandBuilder } = require("discord.js")
const guard = require("../../../middleware/permission.guard")
const safeReply = require("../../../utils/safeReply")
const error = require("../../../messages/embeds/error.embed")
const moderation = require("../../../messages/embeds/moderation.embed")
const kickService = require("../../../services/moderation/kick.service")

module.exports = {
  data: new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a user")
    .addUserOption(o => o.setName("user").setDescription("Target user").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason")),
  async execute(interaction) {
    const check = guard.moderation(interaction)
    if (!check.ok) return safeReply(interaction, { embeds: [error(check.reason)] })

    const member = interaction.options.getMember("user")
    if (!member) return safeReply(interaction, { embeds: [error("Member not found")] })

    const reason = interaction.options.getString("reason") || "No reason provided"
    await kickService.run({ guild: interaction.guild, member, moderatorId: interaction.user.id, reason })

    await safeReply(interaction, {
      embeds: [moderation({ action: "kick", target: `<@${member.id}>`, reason, moderator: `<@${interaction.user.id}>` })]
    })
  }
}
