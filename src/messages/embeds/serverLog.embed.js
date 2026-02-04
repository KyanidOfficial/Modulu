const { EmbedBuilder } = require("discord.js")
const COLORS = require("../../utils/colors")

module.exports = data =>
  new EmbedBuilder()
    .setColor(data.color || COLORS.warning)
    .setTitle("Server log")
    .setDescription(
      `**Event:** ${data.event}\n` +
      `**Target:** ${data.target || "N/A"}\n` +
      (data.executor ? `**By:** ${data.executor}\n` : "") +
      (data.details ? `**Details:** ${data.details}\n` : "")
    )
    .setTimestamp()