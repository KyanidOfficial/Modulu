// Responsible for applying the draft: create roles/channels and return the resulting IDs
module.exports = async function applySetup(guild, draft) {
  const result = {
    roles: {},
    channels: {},
    warnings: []
  }

  // Roles
  if (draft.roles) {
    for (const key of ["moderator", "admin"]) {
      const name = draft.roles[key]
      if (!name) continue

      // try find existing role by name
      const existing = guild.roles.cache.find(r => r.name === name)
      if (existing) {
        result.roles[key] = existing.id
        continue
      }

      // create role
      try {
        const created = await guild.roles.create({
          name,
          reason: "Setup: creating role"
        })
        result.roles[key] = created.id
      } catch (err) {
        result.warnings.push(`Failed to create role ${name}`)
      }
    }
  }

  // Channels
  if (draft.channels) {
    for (const key of ["logs", "appeals", "suspicious"]) {
      const name = draft.channels[key]
      if (!name) continue

      const existing = guild.channels.cache.find(c => c.name === name && c.type === 0)
      if (existing) {
        result.channels[key] = existing.id
        continue
      }

      try {
        const created = await guild.channels.create({
          name,
          type: 0,
          reason: "Setup: creating channel"
        })

        result.channels[key] = created.id

        // basic perms: deny @everyone VIEW_CHANNEL for appeals if desired? Keep default for now.
      } catch (err) {
        result.warnings.push(`Failed to create channel ${name}`)
      }
    }
  }

  return result
}