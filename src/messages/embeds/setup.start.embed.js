const { EmbedBuilder } = require("discord.js")
const COLORS = require("../../utils/colors")

module.exports = (guild) =>
  new EmbedBuilder()
    .setTitle("Server setup")
    .setColor(COLORS.success)
    .setDescription(
      `Welcome to server setup for ${guild.name}.
      Nothing will be applied until you confirm.
      Use the buttons to configure roles, channels, and behavior.`
    )