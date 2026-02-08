const SESSION_TIMEOUT_MS = 1000 * 60 * 15

const sessions = new Map()

const keyOf = (guildId, userId) => `${guildId}:${userId}`

const clearExpiredSessions = () => {
  const now = Date.now()
  for (const [key, session] of sessions.entries()) {
    if (session.expiresAt <= now) sessions.delete(key)
  }
}

const createSession = session => {
  clearExpiredSessions()
  const key = keyOf(session.guildId, session.userId)
  const next = {
    ...session,
    answers: Array.isArray(session.answers) ? session.answers : [],
    step: Number.isInteger(session.step) ? session.step : 0,
    lock: false,
    expiresAt: Date.now() + SESSION_TIMEOUT_MS
  }
  sessions.set(key, next)
  return next
}

const getSession = ({ guildId, userId }) => {
  clearExpiredSessions()
  return sessions.get(keyOf(guildId, userId)) || null
}

const touchSession = ({ guildId, userId }) => {
  const session = getSession({ guildId, userId })
  if (!session) return null
  session.expiresAt = Date.now() + SESSION_TIMEOUT_MS
  return session
}

const updateSession = ({ guildId, userId, patch }) => {
  const session = getSession({ guildId, userId })
  if (!session) return null
  Object.assign(session, patch || {})
  session.expiresAt = Date.now() + SESSION_TIMEOUT_MS
  return session
}

const clearSession = ({ guildId, userId }) => {
  const key = keyOf(guildId, userId)
  const session = sessions.get(key) || null
  sessions.delete(key)
  return session
}

const clearAllSessions = () => {
  sessions.clear()
}

const beginSessionLock = ({ guildId, userId }) => {
  const session = getSession({ guildId, userId })
  if (!session || session.lock) return false
  session.lock = true
  return true
}

const endSessionLock = ({ guildId, userId }) => {
  const session = getSession({ guildId, userId })
  if (!session) return
  session.lock = false
}

module.exports = {
  createSession,
  getSession,
  touchSession,
  updateSession,
  clearSession,
  clearAllSessions,
  beginSessionLock,
  endSessionLock
}
