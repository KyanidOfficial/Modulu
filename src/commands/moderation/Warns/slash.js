const { SlashCommandBuilder, PermissionsBitField } = require("discord.js")
const db = require("../../../core/database")
const warnsEmbed = require("../../../messages/embeds/warns.embed")
const errorEmbed = require("../../../messages/embeds/error.embed")
const COLORS = require("../../../utils/colors")

module.exports = {
  data: new SlashCommandBuilder()
    .setName("warns")
    .setDescription("View user warnings")
    .addUserOption(o =>
      o.setName("user").setDescription("Target user").setRequired(true)
    ),

  async execute(interaction) {
    const guild = interaction.guild
    if (!guild) throw new Error("No guild context")

    const executor = interaction.member
    const user = interaction.options.getUser("user")

    if (!executor.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      return interaction.editReply({
        embeds: [errorEmbed({
          users: `<@${interaction.user.id}>`,
          punishment: "warns",
          state: "failed",
          reason: "Missing permissions",
          color: COLORS.error
        })]
      })
    }

    const list = await db.getWarnings(guild.id, user.id)

    const content = list.length
      ? list.map(w =>
          `\`${w.id}\`\n` +
          `**Status:** ${w.active ? "Active" : "Revoked"}\n` +
          `**Reason:** ${w.reason}\n` +
          `**Issued By:** <@${w.moderator_id}>`
        ).join("\n\n")
      : "No warnings"

    return interaction.editReply({
      embeds: [warnsEmbed(`<@${user.id}>`, content)]
    })
  }
}