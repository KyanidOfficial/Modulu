const { SlashCommandBuilder, EmbedBuilder } = require("discord.js")
const guard = require("../../../core/middleware/permissionGuard")
const reputation = require("../../../modules/reputation")

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rep")
    .setDescription("Reputation tools")
    .addSubcommand(s => s.setName("view").setDescription("View user reputation").addUserOption(o => o.setName("user").setDescription("target").setRequired(true)))
    .addSubcommand(s => s.setName("leaderboard").setDescription("Leaderboard").addIntegerOption(o => o.setName("page").setDescription("page")))
    .addSubcommand(s =>
      s
        .setName("adjust")
        .setDescription("Adjust user reputation")
        .addUserOption(o => o.setName("user").setDescription("target").setRequired(true))
        .addIntegerOption(o => o.setName("value").setDescription("delta").setRequired(true))
        .addStringOption(o => o.setName("reason").setDescription("reason").setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand()
    const guildId = interaction.guildId

    if (sub === "view") {
      const user = interaction.options.getUser("user", true)
      const rep = await reputation.view(guildId, user.id)
      await interaction.editReply({ content: `${user.tag} reputation: ${rep.score}` })
      return
    }

    if (sub === "leaderboard") {
      const page = interaction.options.getInteger("page") || 1
      const rows = await reputation.leaderboard(guildId, page, 10)
      const desc = rows.map((r, i) => `${i + 1}. <@${r.user_id}> — ${r.score}`).join("\n") || "No data"
      await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("Reputation Leaderboard").setDescription(desc)] })
      return
    }

    if (!guard.require(interaction, ["ManageGuild"])) {
      await interaction.editReply({ content: "Missing permission", ephemeral: true })
      return
    }

    const user = interaction.options.getUser("user", true)
    const value = interaction.options.getInteger("value", true)
    const reason = interaction.options.getString("reason", true)
    await reputation.adjust(guildId, user.id, value, interaction.user.id, reason)
    await interaction.editReply(`Adjusted ${user.tag} by ${value}`)
  }
}
