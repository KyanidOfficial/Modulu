const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js")
const { getSimTestService } = require("../../../core/sim/testing")
const { getSimService } = require("../../../core/sim")

const COMMAND_ENABLED = process.env.SIM_ENABLED === "true" && process.env.SIM_TEST_MODE === "true"

const toSummary = report => {
  if (!report) return "No report generated"
  const state = report.state?.dimensions || {}
  const metadata = report.state?.metadata || {}
  return [
    `GlobalRisk: ${Number(report.globalRisk || 0).toFixed(3)}`,
    `Level: ${report.level}/${report.rawLevel}`,
    `spamAggression: ${Number(state.spamAggression || 0).toFixed(3)}`,
    `groomingProbability: ${Number(state.groomingProbability || 0).toFixed(3)}`,
    `harassmentEscalation: ${Number(state.harassmentEscalation || 0).toFixed(3)}`,
    `coordinationLikelihood: ${Number(state.coordinationLikelihood || 0).toFixed(3)}`,
    `velocity: ${Number(metadata.velocity || 0).toFixed(6)}`,
    `acceleration: ${Number(metadata.acceleration || 0).toFixed(6)}`
  ].join("\n")
}

module.exports = {
  COMMAND_ENABLED,
  data: new SlashCommandBuilder()
    .setName("sim")
    .setDescription("SIM testing and inspection")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommandGroup(group =>
      group
        .setName("test")
        .setDescription("SIM synthetic tests")
        .addSubcommand(sub =>
          sub.setName("spam").setDescription("Simulate spam risk")
            .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName("grooming").setDescription("Simulate directed grooming")
            .addUserOption(o => o.setName("attacker").setDescription("Attacker").setRequired(true))
            .addUserOption(o => o.setName("target").setDescription("Target").setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName("harassment").setDescription("Simulate harassment escalation")
            .addUserOption(o => o.setName("attacker").setDescription("Attacker").setRequired(true))
            .addUserOption(o => o.setName("target").setDescription("Target").setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName("cluster").setDescription("Simulate coordination cluster")
            .addUserOption(o => o.setName("user1").setDescription("User 1").setRequired(true))
            .addUserOption(o => o.setName("user2").setDescription("User 2").setRequired(true))
            .addUserOption(o => o.setName("user3").setDescription("User 3").setRequired(true))
        )
    )
    .addSubcommand(sub =>
      sub.setName("inspect").setDescription("Inspect SIM state")
        .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    )
    .addSubcommandGroup(group =>
      group
        .setName("scenario")
        .setDescription("Scenario simulations")
        .addSubcommand(sub =>
          sub.setName("grooming").setDescription("Run multi-stage grooming scenario")
            .addUserOption(o => o.setName("attacker").setDescription("Attacker").setRequired(true))
            .addUserOption(o => o.setName("target").setDescription("Target").setRequired(true))
        )
    )
    .addSubcommand(sub =>
      sub.setName("reset").setDescription("Reset SIM user state")
        .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    ),

  async execute(interaction) {
    const guild = interaction.guild
    if (!guild) {
      await interaction.editReply({ content: "Guild-only command." })
      return
    }

    const group = interaction.options.getSubcommandGroup(false)
    const sub = interaction.options.getSubcommand()
    const testService = getSimTestService()
    const sim = getSimService()

    if (!testService || !sim) {
      await interaction.editReply({ content: "SIM testing is disabled. Enable SIM_ENABLED=true and SIM_TEST_MODE=true." })
      return
    }

    if (group === "test" && sub === "spam") {
      const user = interaction.options.getUser("user", true)
      const report = await testService.simulateRisk(guild.id, user.id, "spamAggression", 0.8)
      await interaction.editReply({ content: `Simulated spam for <@${user.id}>\n\n${toSummary(report)}` })
      return
    }

    if (group === "test" && sub === "grooming") {
      const attacker = interaction.options.getUser("attacker", true)
      const target = interaction.options.getUser("target", true)
      await testService.simulateRisk(guild.id, attacker.id, "groomingProbability", 0.75)
      const report = await testService.simulateDirectedRisk(guild.id, attacker.id, target.id, "grooming", 0.75)
      await interaction.editReply({ content: `Simulated grooming <@${attacker.id}> -> <@${target.id}>\n\n${toSummary(report)}` })
      return
    }

    if (group === "test" && sub === "harassment") {
      const attacker = interaction.options.getUser("attacker", true)
      const target = interaction.options.getUser("target", true)
      await testService.simulateRisk(guild.id, attacker.id, "harassmentEscalation", 0.82)
      const report = await testService.simulateDirectedRisk(guild.id, attacker.id, target.id, "harassment", 0.78)
      await testService.simulateTrajectory(guild.id, attacker.id, "harassmentEscalation", 0.06)
      await interaction.editReply({ content: `Simulated harassment <@${attacker.id}> -> <@${target.id}>\n\n${toSummary(report)}` })
      return
    }

    if (group === "test" && sub === "cluster") {
      const users = [
        interaction.options.getUser("user1", true),
        interaction.options.getUser("user2", true),
        interaction.options.getUser("user3", true)
      ]

      const reports = await testService.simulateCluster(guild.id, users.map(u => u.id), 0.84)
      await interaction.editReply({ content: `Simulated cluster for ${users.map(u => `<@${u.id}>`).join(", ")}\n\n${toSummary(reports[0])}` })
      return
    }

    if (!group && sub === "inspect") {
      const user = interaction.options.getUser("user", true)
      const report = sim.getUserReport(guild.id, user.id)
      await interaction.editReply({ content: `SIM Inspect <@${user.id}>\n\n${JSON.stringify(report, null, 2).slice(0, 1800)}` })
      return
    }

    if (group === "scenario" && sub === "grooming") {
      const attacker = interaction.options.getUser("attacker", true)
      const target = interaction.options.getUser("target", true)
      const report = await testService.runGroomingScenario(guild.id, attacker.id, target.id)
      await interaction.editReply({ content: `Grooming scenario completed <@${attacker.id}> -> <@${target.id}>\n\n${toSummary(report)}` })
      return
    }

    if (!group && sub === "reset") {
      const user = interaction.options.getUser("user", true)
      sim.resetUserState(guild.id, user.id)
      await interaction.editReply({ content: `SIM state reset for <@${user.id}>.` })
    }
  }
}
