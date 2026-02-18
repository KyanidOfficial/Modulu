const { SlashCommandBuilder, PermissionsBitField } = require("discord.js")
const { handleRiskSlash } = require("../../../core/risk/panel/runtime")
const { getRiskRuntimeStatus } = require("../../../core/risk/runtime")

module.exports = {
  data: new SlashCommandBuilder()
    .setName("risk")
    .setDescription("Discord-native risk intelligence panel")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
    .addSubcommand(sub => sub.setName("overview").setDescription("View risk overview"))
    .addSubcommand(sub =>
      sub
        .setName("user")
        .setDescription("View risk details for a user")
        .addUserOption(opt => opt.setName("user").setDescription("Target user").setRequired(true))
    )
    .addSubcommand(sub => sub.setName("top").setDescription("View top risk users"))
    .addSubcommand(sub => sub.setName("alts").setDescription("View high alt-likelihood users"))
    .addSubcommand(sub => sub.setName("heatmap").setDescription("View risk heatmap activity")),

  skipDefer: true,

  async execute(interaction) {
    if (!interaction.client.riskEngine) {
      const runtime = getRiskRuntimeStatus()
      const message = runtime.errorCode === "DIST_MISSING_AFTER_BUILD"
        ? "Risk build artifacts are missing after auto-build attempt. Check startup logs."
        : "RiskEngine failed to initialize. Check startup logs."

      await interaction.reply({ content: message, ephemeral: true })
      return
    }

    await handleRiskSlash(interaction, interaction.client.riskEngine)
  }
}
