const { EmbedBuilder } = require("discord.js")
const COLORS = require("../../shared/utils/colors")
const { EMOJIS } = require("../../shared/utils/constants")

module.exports = message =>
  new EmbedBuilder()
    .setTitle(`Success!`)
    .setColor(COLORS.success)
    .setDescription(message)