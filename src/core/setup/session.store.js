const sessions = new Map()

module.exports = {
get: guildId => sessions.get(guildId),
set: (guildId, data) => sessions.set(guildId, data),
clear: guildId => sessions.delete(guildId),
has: guildId => sessions.has(guildId)
}