const { EmbedBuilder } = require("discord.js")
const COLORS = require("../../utils/colors")

module.exports = () =>
  new EmbedBuilder()
    .setColor(COLORS.error)
    .setTitle("Auto Clock-Out")
    .setDescription("You were clocked out due to inactivity.")