const { SlashCommandBuilder } = require("discord.js")
const staffDb = require("../../../core/database/staffTime")
const format = require("../../../utils/timeFormat")

const checkEmbed = require("../../../messages/embeds/time.check.embed")
const leaderboardEmbed = require("../../../messages/embeds/time.leaderboard.embed")

module.exports = {
  data: new SlashCommandBuilder()
    .setName("time")
    .setDescription("Staff time commands")
    .addSubcommand(s =>
      s.setName("check").setDescription("Check your staff time")
    )
    .addSubcommand(s =>
      s.setName("leaderboard").setDescription("View staff leaderboard")
    ),

  async execute(interaction) {
    const guildId = interaction.guild.id
    const userId = interaction.user.id
    const sub = interaction.options.getSubcommand()

    if (sub === "check") {
      const rows = await staffDb.getTotals(guildId)
      const row = rows.find(r => r.user_id === userId)

      return interaction.editReply({
        embeds: [checkEmbed(row ? format(row.seconds) : null)]
      })
    }

    if (sub === "leaderboard") {
      const rows = await staffDb.getTotals(guildId)

      const lines = rows.map(
        (r, i) => `${i + 1}. <@${r.user_id}> • ${format(r.seconds)}`
      )

      return interaction.editReply({
        embeds: [leaderboardEmbed(lines)]
      })
    }
  }
}