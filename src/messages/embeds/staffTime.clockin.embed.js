const { EmbedBuilder } = require("discord.js")
const COLORS = require("../../utils/colors")

module.exports = () =>
  new EmbedBuilder()
    .setColor(COLORS.success)
    .setTitle("Staff Duty")
    .setDescription("You are now clocked in.")