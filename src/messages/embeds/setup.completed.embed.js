const { EmbedBuilder } = require("discord.js")
const COLORS = require("../../shared/utils/colors")

module.exports = (summary) =>
  new EmbedBuilder()
    .setTitle("Setup completed")
    .setColor(COLORS.success)
    .setDescription(summary)