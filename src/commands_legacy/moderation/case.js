const { SlashCommandBuilder } = require("discord.js")
const db = require("../../core/database")
const viewer = require("../../modules/case/viewer")
const guard = require("../../core/middleware/permissionGuard")

module.exports = {
  data: new SlashCommandBuilder()
    .setName("case")
    .setDescription("Case tools")
    .addSubcommand(s => s.setName("view").setDescription("View case").addIntegerOption(o => o.setName("id").setDescription("case id").setRequired(true)))
    .addSubcommand(s =>
      s
        .setName("history")
        .setDescription("User case history")
        .addUserOption(o => o.setName("user").setDescription("target user").setRequired(true))
        .addIntegerOption(o => o.setName("page").setDescription("page").setRequired(false))
    ),

  async execute(interaction) {
    if (!guard.require(interaction, ["ModerateMembers"])) {
      await interaction.reply({ content: "Missing permission", ephemeral: true })
      return
    }

    const sub = interaction.options.getSubcommand()
    const guildId = interaction.guildId

    if (sub === "view") {
      const id = interaction.options.getInteger("id", true)
      const row = await db.getCaseById(guildId, id)
      if (!row) {
        await interaction.reply({ content: "Case not found", ephemeral: true })
        return
      }
      await interaction.reply({ embeds: [viewer.caseEmbed(row)] })
      return
    }

    const user = interaction.options.getUser("user", true)
    const page = interaction.options.getInteger("page") || 1
    const pageSize = 5
    const rows = await db.getCaseHistory(guildId, user.id, pageSize, (page - 1) * pageSize)
    const embeds = viewer.historyEmbeds(rows)
    await interaction.reply({ embeds: [embeds[0]] })
  }
}
