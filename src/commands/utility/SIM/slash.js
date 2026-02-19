const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js")
const { getSimTestService } = require("../../../core/sim/testing")
const { getSimService } = require("../../../core/sim")

const COMMAND_ENABLED = process.env.SIM_ENABLED === "true" && process.env.SIM_TEST_MODE === "true"

const toSummary = report => {
  if (!report) return "No report"
  const state = report.state?.dimensions || {}
  const metadata = report.state?.metadata || {}
  return [
    `Risk: ${Number(report.globalRisk || 0).toFixed(3)}`,
    `Level: ${report.level}/${report.rawLevel}`,
    `Spam: ${Number(state.spamAggression || 0).toFixed(3)}`,
    `Groom: ${Number(state.groomingProbability || 0).toFixed(3)}`,
    `Harass: ${Number(state.harassmentEscalation || 0).toFixed(3)}`,
    `Coord: ${Number(state.coordinationLikelihood || 0).toFixed(3)}`,
    `V: ${Number(metadata.velocity || 0).toFixed(6)}`,
    `A: ${Number(metadata.acceleration || 0).toFixed(6)}`
  ].join("\n")
}

module.exports = {
  COMMAND_ENABLED,
  data: new SlashCommandBuilder()
    .setName("sim")
    .setDescription("SIM test")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName("test").setDescription("Run test")
        .addStringOption(o =>
          o.setName("kind").setDescription("Type").setRequired(true)
            .addChoices(
              { name: "spam", value: "spam" },
              { name: "grooming", value: "grooming" },
              { name: "harassment", value: "harassment" },
              { name: "cluster", value: "cluster" }
            )
        )
        .addUserOption(o => o.setName("user").setDescription("User"))
        .addUserOption(o => o.setName("target").setDescription("Target"))
        .addUserOption(o => o.setName("user2").setDescription("User2"))
        .addUserOption(o => o.setName("user3").setDescription("User3"))
    )
    .addSubcommand(sub =>
      sub.setName("scenario").setDescription("Run scenario")
        .addStringOption(o =>
          o.setName("kind").setDescription("Type").setRequired(true)
            .addChoices({ name: "grooming", value: "grooming" })
        )
        .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
        .addUserOption(o => o.setName("target").setDescription("Target").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("inspect").setDescription("Inspect user")
        .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("reset").setDescription("Reset user")
        .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    ),

  async execute(interaction) {
    const guild = interaction.guild
    if (!guild) return interaction.editReply({ content: "Guild only." })

    const testService = getSimTestService()
    const sim = getSimService()
    if (!testService || !sim) {
      return interaction.editReply({ content: "SIM test disabled." })
    }

    const sub = interaction.options.getSubcommand()

    if (sub === "inspect") {
      const user = interaction.options.getUser("user", true)
      const report = sim.getUserReport(guild.id, user.id)
      return interaction.editReply({ content: `Inspect <@${user.id}>\n\n${JSON.stringify(report, null, 2).slice(0, 1800)}` })
    }

    if (sub === "reset") {
      const user = interaction.options.getUser("user", true)
      sim.resetUserState(guild.id, user.id)
      return interaction.editReply({ content: `Reset <@${user.id}>` })
    }

    if (sub === "scenario") {
      const kind = interaction.options.getString("kind", true)
      const attacker = interaction.options.getUser("user", true)
      const target = interaction.options.getUser("target", true)

      if (kind === "grooming") {
        const report = await testService.runGroomingScenario(guild.id, attacker.id, target.id)
        return interaction.editReply({ content: `Scenario grooming <@${attacker.id}> -> <@${target.id}>\n\n${toSummary(report)}` })
      }
    }

    if (sub === "test") {
      const kind = interaction.options.getString("kind", true)
      const user = interaction.options.getUser("user")
      const target = interaction.options.getUser("target")

      if (kind === "spam") {
        if (!user) return interaction.editReply({ content: "Missing user" })
        const report = await testService.simulateRisk(guild.id, user.id, "spamAggression", 0.8)
        return interaction.editReply({ content: `Spam <@${user.id}>\n\n${toSummary(report)}` })
      }

      if (kind === "grooming") {
        if (!user || !target) return interaction.editReply({ content: "Missing user/target" })
        await testService.simulateRisk(guild.id, user.id, "groomingProbability", 0.9)
        const report = await testService.simulateDirectedRisk(guild.id, user.id, target.id, "grooming", 0.9)
        return interaction.editReply({ content: `Grooming <@${user.id}> -> <@${target.id}>\n\n${toSummary(report)}` })
      }

      if (kind === "harassment") {
        if (!user || !target) return interaction.editReply({ content: "Missing user/target" })
        await testService.simulateRisk(guild.id, user.id, "harassmentEscalation", 0.82)
        const report = await testService.simulateDirectedRisk(guild.id, user.id, target.id, "harassment", 0.78)
        await testService.simulateTrajectory(guild.id, user.id, "harassmentEscalation", 0.06)
        return interaction.editReply({ content: `Harassment <@${user.id}> -> <@${target.id}>\n\n${toSummary(report)}` })
      }

      if (kind === "cluster") {
        const u1 = user
        const u2 = interaction.options.getUser("user2")
        const u3 = interaction.options.getUser("user3")
        if (!u1 || !u2 || !u3) return interaction.editReply({ content: "Need user, user2, user3" })
        const reports = await testService.simulateCluster(guild.id, [u1.id, u2.id, u3.id], 0.84)
        return interaction.editReply({ content: `Cluster <@${u1.id}>, <@${u2.id}>, <@${u3.id}>\n\n${toSummary(reports[0])}` })
      }
    }

    return interaction.editReply({ content: "Unsupported sim action" })
  }
}
