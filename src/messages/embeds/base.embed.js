const { EmbedBuilder } = require("discord.js")

module.exports = ({ title, description, color, fields = [] }) =>
  new EmbedBuilder().setTitle(title).setDescription(description).setColor(color).addFields(fields)
