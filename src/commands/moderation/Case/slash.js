const { SlashCommandBuilder } = require("discord.js")
const guard = require("../../../middleware/permission.guard")
const safeReply = require("../../../utils/safeReply")
const error = require("../../../messages/embeds/error.embed")
const caseEmbed = require("../../../messages/embeds/case.embed")
const caseService = require("../../../services/case/case.service")

module.exports = {
  data: new SlashCommandBuilder()
    .setName("case")
    .setDescription("View moderation cases")
    .addSubcommand(s => s.setName("view").setDescription("View case").addIntegerOption(o => o.setName("id").setDescription("Case id").setRequired(true)))
    .addSubcommand(s => s.setName("history").setDescription("History").addUserOption(o => o.setName("user").setDescription("Target user").setRequired(true)).addIntegerOption(o => o.setName("page").setDescription("Page"))),
  async execute(interaction) {
    const check = guard.moderation(interaction)
    if (!check.ok) return safeReply(interaction, { embeds: [error(check.reason)] })

    const sub = interaction.options.getSubcommand()
    if (sub === "view") {
      const id = interaction.options.getInteger("id", true)
      const record = await caseService.get(interaction.guildId, id)
      if (!record) return safeReply(interaction, { embeds: [error("Case not found")] })
      return safeReply(interaction, { embeds: [caseEmbed({ caseId: record.case_id || id, action: record.action_type, reason: record.reason, actorId: record.actor_id })] })
    }

    const user = interaction.options.getUser("user", true)
    const page = interaction.options.getInteger("page") || 1
    const rows = await caseService.history(interaction.guildId, user.id, page)
    if (!rows.length) return safeReply(interaction, { embeds: [error("No cases found")] })
    const top = rows[0]
    return safeReply(interaction, { embeds: [caseEmbed({ caseId: top.case_id, action: top.action_type, reason: top.reason, actorId: top.actor_id })] })
  }
}
