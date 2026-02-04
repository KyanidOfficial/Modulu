const { EmbedBuilder } = require("discord.js")
const COLORS = require("../../utils/colors")
const { EMOJIS } = require("../../utils/constants")

module.exports = (user, warns) =>
  new EmbedBuilder()
    .setTitle(`${user} warnings`)
    .setDescription(warns || "No warnings")
    .setColor(COLORS.warning)