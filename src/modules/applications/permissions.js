const { PermissionsBitField } = require("discord.js")

module.exports = {
  isAdmin(member) {
    if (!member || !member.guild) return false

    // Guild owner
    if (member.id === member.guild.ownerId) return true

    // Discord Administrator permission
    if (
      member.permissions.has(PermissionsBitField.Flags.Administrator)
    ) {
      return true
    }

    // Config-based administrator roles
    const roles = member.client?.config?.setup?.roles?.administrators
    if (!Array.isArray(roles)) return false

    return member.roles.cache.some(role => roles.includes(role.id))
  }
}