const { SlashCommandBuilder } = require("discord.js")
const guard = require("../../../middleware/permission.guard")
const safeReply = require("../../../utils/safeReply")
const error = require("../../../messages/embeds/error.embed")
const moderation = require("../../../messages/embeds/moderation.embed")
const warnService = require("../../../services/moderation/warn.service")

module.exports = {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn a user")
    .addUserOption(o => o.setName("user").setDescription("Target user").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason")),
  async execute(interaction) {
    const check = guard.moderation(interaction)
    if (!check.ok) return safeReply(interaction, { embeds: [error(check.reason)] })

    const user = interaction.options.getUser("user", true)
    const reason = interaction.options.getString("reason") || "No reason provided"
    await warnService.run({ guild: interaction.guild, moderatorId: interaction.user.id, userId: user.id, reason })

    await safeReply(interaction, {
      embeds: [moderation({ action: "warn", target: `<@${user.id}>`, reason, moderator: `<@${interaction.user.id}>` })]
    })
  }
}
