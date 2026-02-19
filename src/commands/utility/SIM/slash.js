const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js")
const { getSimTestService } = require("../../../core/sim/testing")
const { getSimService } = require("../../../core/sim")

const COMMAND_ENABLED = process.env.SIM_ENABLED === "true" && process.env.SIM_TEST_MODE === "true"

const ACTIONS = {
  spam: "spam",
  grooming: "grooming",
  harassment: "harassment",
  cluster: "cluster",
  inspect: "inspect",
  scenario_grooming: "scenario_grooming",
  reset: "reset"
}

const toSummary = report => {
  if (!report) return "No report"
  const state = report.state?.dimensions || {}
  const metadata = report.state?.metadata || {}
  return [
    `Risk ${Number(report.globalRisk || 0).toFixed(3)}`,
    `Lvl ${report.level}/${report.rawLevel}`,
    `Spam ${Number(state.spamAggression || 0).toFixed(3)}`,
    `Groom ${Number(state.groomingProbability || 0).toFixed(3)}`,
    `Harass ${Number(state.harassmentEscalation || 0).toFixed(3)}`,
    `Coord ${Number(state.coordinationLikelihood || 0).toFixed(3)}`,
    `Vel ${Number(metadata.velocity || 0).toFixed(6)}`,
    `Acc ${Number(metadata.acceleration || 0).toFixed(6)}`
  ].join("\n")
}

module.exports = {
  COMMAND_ENABLED,
  data: new SlashCommandBuilder()
    .setName("sim")
    .setDescription("SIM test tools")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o =>
      o.setName("action")
        .setDescription("Action")
        .setRequired(true)
        .addChoices(
          { name: "test spam", value: ACTIONS.spam },
          { name: "test grooming", value: ACTIONS.grooming },
          { name: "test harassment", value: ACTIONS.harassment },
          { name: "test cluster", value: ACTIONS.cluster },
          { name: "inspect", value: ACTIONS.inspect },
          { name: "scenario grooming", value: ACTIONS.scenario_grooming },
          { name: "reset", value: ACTIONS.reset }
        )
    )
    .addUserOption(o => o.setName("user1").setDescription("User 1").setRequired(true))
    .addUserOption(o => o.setName("user2").setDescription("User 2"))
    .addUserOption(o => o.setName("user3").setDescription("User 3")),

  async execute(interaction) {
    const guild = interaction.guild
    if (!guild) return interaction.editReply({ content: "Guild only." })

    const sim = getSimService()
    const testService = getSimTestService()
    if (!sim || !testService) {
      return interaction.editReply({ content: "SIM testing disabled." })
    }

    const action = interaction.options.getString("action", true)
    const user1 = interaction.options.getUser("user1", true)
    const user2 = interaction.options.getUser("user2")
    const user3 = interaction.options.getUser("user3")

    if (action === ACTIONS.spam) {
      const report = await testService.simulateRisk(guild.id, user1.id, "spamAggression", 0.8)
      return interaction.editReply({ content: `Spam sim <@${user1.id}>\n${toSummary(report)}` })
    }

    if (action === ACTIONS.grooming) {
      if (!user2) return interaction.editReply({ content: "Need user2." })
      await testService.simulateRisk(guild.id, user1.id, "groomingProbability", 0.75)
      const report = await testService.simulateDirectedRisk(guild.id, user1.id, user2.id, "grooming", 0.75)
      return interaction.editReply({ content: `Groom sim <@${user1.id}> -> <@${user2.id}>\n${toSummary(report)}` })
    }

    if (action === ACTIONS.harassment) {
      if (!user2) return interaction.editReply({ content: "Need user2." })
      await testService.simulateRisk(guild.id, user1.id, "harassmentEscalation", 0.82)
      const report = await testService.simulateDirectedRisk(guild.id, user1.id, user2.id, "harassment", 0.78)
      await testService.simulateTrajectory(guild.id, user1.id, "harassmentEscalation", 0.06)
      return interaction.editReply({ content: `Harass sim <@${user1.id}> -> <@${user2.id}>\n${toSummary(report)}` })
    }

    if (action === ACTIONS.cluster) {
      if (!user2 || !user3) return interaction.editReply({ content: "Need user2 and user3." })
      const reports = await testService.simulateCluster(guild.id, [user1.id, user2.id, user3.id], 0.84)
      return interaction.editReply({ content: `Cluster sim <@${user1.id}>, <@${user2.id}>, <@${user3.id}>\n${toSummary(reports[0])}` })
    }

    if (action === ACTIONS.inspect) {
      const report = sim.getUserReport(guild.id, user1.id)
      return interaction.editReply({ content: `Inspect <@${user1.id}>\n${JSON.stringify(report, null, 2).slice(0, 1800)}` })
    }

    if (action === ACTIONS.scenario_grooming) {
      if (!user2) return interaction.editReply({ content: "Need user2." })
      const report = await testService.runGroomingScenario(guild.id, user1.id, user2.id)
      return interaction.editReply({ content: `Scenario grooming <@${user1.id}> -> <@${user2.id}>\n${toSummary(report)}` })
    }

    if (action === ACTIONS.reset) {
      sim.resetUserState(guild.id, user1.id)
      return interaction.editReply({ content: `Reset <@${user1.id}>` })
    }

    return interaction.editReply({ content: "Unknown action." })
  }
}
