const { EmbedBuilder } = require("discord.js")
const COLORS = require("../../../utils/colors")
const canUse = require("../../../core/middleware/permissions")

module.exports = {
  name: "help",

  async execute(interaction) {
    const commands = [...interaction.client.commands.values()]
      .filter(c => c.meta)
      .filter(c => canUse(interaction.member, c.meta.permissions || []))

    const categories = {}
    for (const c of commands) {
      if (!categories[c.meta.category]) categories[c.meta.category] = []
      categories[c.meta.category].push(c)
    }

    const embed = new EmbedBuilder()
      .setColor(COLORS.success)
      .setTitle("Help")
      .setDescription(
        Object.entries(categories)
          .map(([cat, cmds]) =>
            `**${cat}**\n` +
            cmds.map(c =>
              `**/${c.data?.name || c.name} | ${process.env.PREFIX}${c.name}`
            ).join("\n")
          ).join("\n\n")
      )

    return interaction.reply({ embeds: [embed] })
  }
}