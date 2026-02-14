const { SlashCommandBuilder } = require("discord.js")
const guard = require("../../../middleware/permission.guard")
const safeReply = require("../../../utils/safeReply")
const error = require("../../../messages/embeds/error.embed")
const repEmbed = require("../../../messages/embeds/reputation.embed")
const service = require("../../../services/reputation/reputation.service")

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rep")
    .setDescription("Reputation tools")
    .addSubcommand(s => s.setName("view").setDescription("View user reputation").addUserOption(o => o.setName("user").setDescription("Target").setRequired(true)))
    .addSubcommand(s => s.setName("leaderboard").setDescription("Leaderboard").addIntegerOption(o => o.setName("page").setDescription("Page")))
    .addSubcommand(s => s.setName("adjust").setDescription("Adjust reputation").addUserOption(o => o.setName("user").setDescription("Target").setRequired(true)).addIntegerOption(o => o.setName("value").setDescription("Value").setRequired(true)).addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true))),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand()
    if (sub === "view") {
      const user = interaction.options.getUser("user", true)
      const rep = await service.view(interaction.guildId, user.id)
      return safeReply(interaction, { embeds: [repEmbed({ title: "Reputation", description: `${user.tag}: ${rep.score}` })] })
    }

    if (sub === "leaderboard") {
      const page = interaction.options.getInteger("page") || 1
      const rows = await service.leaderboard(interaction.guildId, page, 10)
      const desc = rows.map((row, i) => `${i + 1}. <@${row.user_id}> — ${row.score}`).join("\n") || "No data"
      return safeReply(interaction, { embeds: [repEmbed({ title: "Reputation Leaderboard", description: desc })] })
    }

    const check = guard.manageGuild(interaction)
    if (!check.ok) return safeReply(interaction, { embeds: [error(check.reason)] })

    const user = interaction.options.getUser("user", true)
    const value = interaction.options.getInteger("value", true)
    const reason = interaction.options.getString("reason", true)
    await service.adjust(interaction.guildId, user.id, value, interaction.user.id, reason)
    return safeReply(interaction, { embeds: [repEmbed({ title: "Reputation", description: `Adjusted ${user.tag} by ${value}` })] })
  }
}
