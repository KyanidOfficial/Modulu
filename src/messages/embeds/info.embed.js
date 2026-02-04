const { EmbedBuilder } = require("discord.js")
const COLORS = require("../../utils/colors")

module.exports = ({ title, description }) =>
  new EmbedBuilder()
    .setColor(COLORS.info)
    .setTitle(title)
    .setDescription(description)