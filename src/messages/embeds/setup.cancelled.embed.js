const { EmbedBuilder } = require("discord.js")
const COLORS = require("../../shared/utils/colors")

module.exports = () =>
  new EmbedBuilder()
    .setTitle("Setup cancelled")
    .setColor(COLORS.error)
    .setDescription("No changes were applied.")