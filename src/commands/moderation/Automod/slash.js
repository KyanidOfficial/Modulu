const { SlashCommandBuilder } = require("discord.js")
const guard = require("../../../middleware/permission.guard")
const safeReply = require("../../../utils/safeReply")
const error = require("../../../messages/embeds/error.embed")
const automodEmbed = require("../../../messages/embeds/automod.embed")
const automodService = require("../../../services/moderation/automod.service")

module.exports = {
  data: new SlashCommandBuilder()
    .setName("automod")
    .setDescription("Manage automod")
    .addSubcommand(s => s.setName("enable").setDescription("Enable automod"))
    .addSubcommand(s => s.setName("disable").setDescription("Disable automod"))
    .addSubcommand(s => s.setName("config-set").setDescription("Set threshold").addStringOption(o => o.setName("key").setDescription("Key").setRequired(true)).addStringOption(o => o.setName("value").setDescription("Value").setRequired(true)))
    .addSubcommand(s => s.setName("config-view").setDescription("View config")),
  async execute(interaction) {
    const check = guard.manageGuild(interaction)
    if (!check.ok) return safeReply(interaction, { embeds: [error(check.reason)] })

    const sub = interaction.options.getSubcommand()
    if (sub === "enable") {
      await automodService.toggle(interaction.guildId, true)
      return safeReply(interaction, { embeds: [automodEmbed("Enabled")] })
    }
    if (sub === "disable") {
      await automodService.toggle(interaction.guildId, false)
      return safeReply(interaction, { embeds: [automodEmbed("Disabled")] })
    }
    if (sub === "config-set") {
      const key = interaction.options.getString("key", true)
      const value = interaction.options.getString("value", true)
      await automodService.setThreshold(interaction.guildId, key, value)
      return safeReply(interaction, { embeds: [automodEmbed(`Updated ${key}`)] })
    }

    const config = await automodService.getConfig(interaction.guildId)
    return safeReply(interaction, { embeds: [automodEmbed(`\`${JSON.stringify(config)}\``)] })
  }
}
