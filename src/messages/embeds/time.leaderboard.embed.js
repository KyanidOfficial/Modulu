const { EmbedBuilder } = require("discord.js")
const COLORS = require("../../utils/colors")

module.exports = lines => {
  return new EmbedBuilder()
    .setColor(COLORS.info)
    .setTitle("Staff Time Leaderboard")
    .setDescription(
      lines.length
        ? lines.join("\n")
        : "No data available."
    )
}