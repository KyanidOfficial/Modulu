const { EmbedBuilder } = require("discord.js")
const COLORS = require("../../utils/colors")

module.exports = input =>
  new EmbedBuilder()
    .setColor(COLORS.warning)
    .setDescription(
      input.state === "started"
        ? `Raid detected. ${input.joins} joins in short time.`
        : "Raid ended."
    )