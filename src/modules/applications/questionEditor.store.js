const EDITOR_TTL_MS = 1000 * 60 * 15

const states = new Map()

const cleanup = () => {
  const now = Date.now()
  for (const [key, state] of states.entries()) {
    if (state.expiresAt <= now) states.delete(key)
  }
}

const getKey = (guildId, userId) => `${guildId}:${userId}`

const setState = ({ guildId, userId, type }) => {
  cleanup()
  const key = getKey(guildId, userId)
  states.set(key, {
    guildId,
    userId,
    type,
    expiresAt: Date.now() + EDITOR_TTL_MS
  })
  return states.get(key)
}

const getState = ({ guildId, userId }) => {
  cleanup()
  return states.get(getKey(guildId, userId)) || null
}

const clearState = ({ guildId, userId }) => {
  states.delete(getKey(guildId, userId))
}

module.exports = {
  setState,
  getState,
  clearState
}
