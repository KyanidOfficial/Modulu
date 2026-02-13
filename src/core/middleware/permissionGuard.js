module.exports = {
  require(interaction, permissions = []) {
    if (!interaction.memberPermissions) return false
    return permissions.every(perm => interaction.memberPermissions.has(perm))
  }
}
