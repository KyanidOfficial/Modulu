const { SlashCommandBuilder, PermissionsBitField } = require("discord.js")
const store = require("../../../modules/automod/store")

const parseCSV = input =>
  input
    .split(",")
    .map(x => x.trim())
    .filter(Boolean)

module.exports = {
  data: new SlashCommandBuilder()
    .setName("automod")
    .setDescription("Manage auto-moderation settings")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
    .addSubcommand(sub =>
      sub
        .setName("toggle")
        .setDescription("Enable or disable a check")
        .addStringOption(o =>
          o
            .setName("check")
            .setDescription("Check name")
            .setRequired(true)
            .addChoices(
              { name: "blacklist", value: "blacklist" },
              { name: "spam", value: "spam" },
              { name: "links", value: "links" },
              { name: "invites", value: "invites" },
              { name: "mentions", value: "mentions" },
              { name: "rateLimit", value: "rateLimit" },
              { name: "attachments", value: "attachments" },
              { name: "aiModeration", value: "aiModeration" }
            )
        )
        .addBooleanOption(o => o.setName("enabled").setDescription("Enabled?").setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName("add-pattern")
        .setDescription("Add blacklist words or regex")
        .addStringOption(o =>
          o.setName("type").setDescription("Pattern type").setRequired(true).addChoices(
            { name: "word", value: "word" },
            { name: "regex", value: "regex" }
          )
        )
        .addStringOption(o => o.setName("value").setDescription("Value").setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName("remove-pattern")
        .setDescription("Remove blacklist words or regex")
        .addStringOption(o =>
          o.setName("type").setDescription("Pattern type").setRequired(true).addChoices(
            { name: "word", value: "word" },
            { name: "regex", value: "regex" }
          )
        )
        .addStringOption(o => o.setName("value").setDescription("Value").setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName("set-blocked-domains")
        .setDescription("Set blocked domains list (comma separated)")
        .addStringOption(o => o.setName("domains").setDescription("domain1.com, domain2.com").setRequired(true))
    )
    .addSubcommand(sub => sub.setName("show").setDescription("Show current automod config")),

  async execute(interaction) {
    const guildId = interaction.guild.id
    const cfg = await store.getConfig(guildId)
    const sub = interaction.options.getSubcommand()

    if (sub === "toggle") {
      const check = interaction.options.getString("check", true)
      const enabled = interaction.options.getBoolean("enabled", true)
      cfg.checks[check] = enabled
      await store.saveConfig(guildId, cfg)
      return interaction.editReply(`Updated check **${check}** => **${enabled}**`)
    }

    if (sub === "add-pattern") {
      const type = interaction.options.getString("type", true)
      const value = interaction.options.getString("value", true)
      const key = type === "word" ? "blacklistWords" : "blacklistRegex"
      if (!cfg[key].includes(value)) cfg[key].push(value)
      await store.saveConfig(guildId, cfg)
      return interaction.editReply(`Added ${type} pattern: \`${value}\``)
    }

    if (sub === "remove-pattern") {
      const type = interaction.options.getString("type", true)
      const value = interaction.options.getString("value", true)
      const key = type === "word" ? "blacklistWords" : "blacklistRegex"
      cfg[key] = cfg[key].filter(item => item !== value)
      await store.saveConfig(guildId, cfg)
      return interaction.editReply(`Removed ${type} pattern: \`${value}\``)
    }

    if (sub === "set-blocked-domains") {
      cfg.links.blockedDomains = parseCSV(interaction.options.getString("domains", true)).map(d => d.toLowerCase())
      await store.saveConfig(guildId, cfg)
      return interaction.editReply(`Blocked domains updated (${cfg.links.blockedDomains.length}).`)
    }

    return interaction.editReply([
      `enabled: ${cfg.enabled}`,
      `checks: ${Object.entries(cfg.checks).map(([k, v]) => `${k}=${v}`).join(", ")}`,
      `blacklistWords: ${cfg.blacklistWords.length}`,
      `blacklistRegex: ${cfg.blacklistRegex.length}`,
      `blockedDomains: ${cfg.links.blockedDomains.length}`,
      `rateLimit: ${cfg.rateLimit.maxMessages}/${cfg.rateLimit.windowMs}ms`
    ].join("\n"))
  }
}
