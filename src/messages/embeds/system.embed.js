const { EmbedBuilder } = require("discord.js")
const COLORS = require("../../utils/colors")

module.exports = ({ title, description, color }) => {
  return new EmbedBuilder()
    .setColor(color || COLORS.info)
    .setTitle(title || "System Update")
    .setDescription(description || "No details provided.")
    .setTimestamp()
}
