const COMMAND_ENABLED = true
const { SlashCommandBuilder, PermissionsBitField } = require("discord.js")
const warnsEmbed = require("../../../messages/embeds/warns.embed")
const errorEmbed = require("../../../messages/embeds/error.embed")
const COLORS = require("../../../utils/colors")
const { resolveModerationAccess } = require("../../../utils/permissionResolver")
const warningStore = require("../../../modules/warnings/store")

module.exports = {
  COMMAND_ENABLED,
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

    const access = await resolveModerationAccess({
      guildId: guild.id,
      member: executor,
      requiredDiscordPerms: [PermissionsBitField.Flags.ModerateMembers]
    })

    if (!access.allowed) {
      return interaction.editReply({
        embeds: [errorEmbed({
          users: `<@${interaction.user.id}>`,
          punishment: "warns",
          state: "failed",
          reason: access.reason,
          moderator: `<@${interaction.user.id}>`,
          color: COLORS.error
        })]
      })
    }

    try {
      const list = await warningStore.listWarnings(guild.id, user.id)

      const content = list.length
        ? list.map(w =>
          `\`${w.id}\`\n` +
          `**Status:** ${w.active ? "Active" : "Revoked"}\n` +
          `**Reason:** ${w.reason}\n` +
          `**Issued By:** <@${w.moderator_id}>\n` +
          `**Created:** <t:${Math.floor(Number(w.created_at) / 1000)}:F>`
        ).join("\n\n")
        : "No warnings found"

      return interaction.editReply({
        embeds: [warnsEmbed({
          userMention: `<@${user.id}>`,
          content,
          moderatorMention: `<@${interaction.user.id}>`,
          color: COLORS.info
        })]
      })
    } catch (err) {
      console.error("[WARNS] Failed to fetch warnings", err)
      return interaction.editReply({
        embeds: [errorEmbed({
          users: `<@${user.id}>`,
          punishment: "warns",
          state: "failed",
          reason: "Failed to fetch warnings from persistent storage",
          moderator: `<@${interaction.user.id}>`,
          color: COLORS.error
        })]
      })
    }
  }
}
