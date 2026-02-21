const db = require("../../core/database")

const applyOverwrites = async (guild, role, overwrites) => {
  const channels = guild.channels.cache.values()
  for (const channel of channels) {
    if (!channel.isTextBased() && channel.type !== 2 && channel.type !== 13) {
      continue
    }

    try {
      await channel.permissionOverwrites.edit(role, overwrites)
    } catch (err) {
      console.warn("[ROLE] Failed to apply overwrite", channel.id, err.message)
    }
  }
}

module.exports = async ({
  guild,
  roleKey,
  roleName,
  permissions = [],
  overwrites
}) => {
  if (!guild) return null

  const data = await db.get(guild.id)
  data.setup = data.setup || {}
  data.setup.roles = data.setup.roles || {}

  let roleId = data.setup.roles[roleKey]
  let role = roleId ? guild.roles.cache.get(roleId) : null

  if (!role) {
    role = guild.roles.cache.find(r => r.name === roleName) || null
  }

  if (!role) {
    role = await guild.roles.create({
      name: roleName,
      permissions,
      reason: "Moderation role setup"
    })
  }

  if (role) {
    data.setup.roles[roleKey] = role.id
    await db.save(guild.id, data)
  }

  if (role && overwrites) {
    await applyOverwrites(guild, role, overwrites)
  }

  return role
}
