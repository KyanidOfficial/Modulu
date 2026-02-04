const { EmbedBuilder } = require("discord.js")
const COLORS = require("../../utils/colors")
const { EMOJIS } = require("../../utils/constants")

module.exports = (versions, page, totalPages) =>
  new EmbedBuilder()
    .setColor(COLORS.error)
    .setTitle(`Update Logs`)
    .setFooter({ text: `Page ${page + 1} / ${totalPages}` })
    .setDescription(
      versions.map(v =>
        `\`${v.version}\`\n` +
        v.changes.map(c => `> - ${c}`).join("\n")
      ).join("\n\n")
    )