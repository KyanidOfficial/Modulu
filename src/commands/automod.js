const { SlashCommandBuilder } = require("discord.js")
const db = require("../core/database")
const guard = require("../core/middleware/permissionGuard")

module.exports = {
  data: new SlashCommandBuilder()
    .setName("automod")
    .setDescription("Manage automod")
    .addSubcommand(s => s.setName("enable").setDescription("Enable automod"))
    .addSubcommand(s => s.setName("disable").setDescription("Disable automod"))
    .addSubcommand(s =>
      s
        .setName("config-set")
        .setDescription("Set automod config")
        .addStringOption(o => o.setName("key").setDescription("threshold key").setRequired(true))
        .addStringOption(o => o.setName("value").setDescription("value").setRequired(true))
    )
    .addSubcommand(s => s.setName("config-view").setDescription("View automod config")),

  async execute(interaction) {
    if (!guard.require(interaction, ["ManageGuild"])) {
      await interaction.reply({ content: "Missing permission", ephemeral: true })
      return
    }

    const guildId = interaction.guildId
    const sub = interaction.options.getSubcommand()

    if (sub === "enable") {
      const config = await db.getAutomodConfig(guildId)
      await db.setAutomodConfig(guildId, { ...config, enabled: true })
      await interaction.reply("Automod enabled")
      return
    }

    if (sub === "disable") {
      const config = await db.getAutomodConfig(guildId)
      await db.setAutomodConfig(guildId, { ...config, enabled: false })
      await interaction.reply("Automod disabled")
      return
    }

    if (sub === "config-set") {
      const key = interaction.options.getString("key", true)
      const value = interaction.options.getString("value", true)
      const config = await db.getAutomodConfig(guildId)
      const num = Number(value)
      const parsed = Number.isNaN(num) ? value : num
      const next = { ...config, thresholds: { ...config.thresholds, [key]: parsed } }
      await db.setAutomodConfig(guildId, next)
      await interaction.reply(`Updated ${key}`)
      return
    }

    const config = await db.getAutomodConfig(guildId)
    await interaction.reply({ content: `\`${JSON.stringify(config, null, 2)}\``, ephemeral: true })
  }
}
