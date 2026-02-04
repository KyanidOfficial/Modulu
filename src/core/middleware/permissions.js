module.exports = (member, perms = []) => {
  if (!perms.length) return true
  if (!member) return false
  return member.permissions.has(perms)
}