const { PermissionsBitField } = require("discord.js")

const ensure = (interaction, permissions) => {
  if (!interaction.inGuild()) return { ok: false, reason: "Guild only command." }
  if (!interaction.memberPermissions) return { ok: false, reason: "Missing member permissions context." }
  const missing = permissions.filter(perm => !interaction.memberPermissions.has(perm))
  if (missing.length) return { ok: false, reason: `Missing permissions: ${missing.join(", ")}` }
  return { ok: true }
}

module.exports = {
  ensure,
  moderation(interaction) {
    return ensure(interaction, [PermissionsBitField.Flags.ModerateMembers])
  },
  manageGuild(interaction) {
    return ensure(interaction, [PermissionsBitField.Flags.ManageGuild])
  }
}
