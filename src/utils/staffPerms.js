const db = require("../core/database")
const { PermissionsBitField } = require("discord.js")

module.exports = async (guildId, member) => {
  if (!member) return false

  if (member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return true
  }

  const data = await db.get(guildId)
  const roles = data?.setup?.roles
  if (!roles) return false

  const allowed = [
    ...(roles.administrators || []),
    ...(roles.moderators || [])
  ]

  if (!allowed.length) return false

  return member.roles.cache.some(r => allowed.includes(r.id))
}