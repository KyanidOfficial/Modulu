const { EmbedBuilder } = require("discord.js")
const COLORS = require("../../utils/colors")
const { EMOJIS } = require("../../utils/constants")

module.exports = message =>
  new EmbedBuilder()
    .setTitle(`Success!`)
    .setColor(COLORS.success)
    .setDescription(message)