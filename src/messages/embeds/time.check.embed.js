const { EmbedBuilder } = require("discord.js")
const COLORS = require("../../utils/colors")

module.exports = seconds => {
  return new EmbedBuilder()
    .setColor(COLORS.info)
    .setTitle("Staff Time")
    .setDescription(
      seconds
        ? `Your total time:\n${seconds}`
        : "No time recorded."
    )
}