const { EmbedBuilder } = require("discord.js")
const COLORS = require("../../utils/colors")

module.exports = time =>
  new EmbedBuilder()
    .setColor(COLORS.warning)
    .setTitle("Staff Duty")
    .setDescription(`You are now clocked out.\nTime: ${time}`)