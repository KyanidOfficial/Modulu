const ACTIVE_TIMEOUT_MS = 1000 * 60 * 10
const APPLICATION_COOLDOWN_MS = 1000 * 60 * 10
const START_SPAM_WINDOW_MS = 1000 * 30

const activeSessions = new Map()
const cooldowns = new Map()
const startAttempts = new Map()

const getCooldownKey = (userId, guildId, type) => `${userId}:${guildId}:${type}`

const canStartApplication = ({ userId, guildId, type }) => {
  const cooldownKey = getCooldownKey(userId, guildId, type)
  const now = Date.now()

  const active = activeSessions.get(userId)
  if (active) {
    return {
      ok: false,
      reason: "You already have an active application in progress. Check your DMs or type `cancel` there."
    }
  }

  const previousAttempt = startAttempts.get(cooldownKey)
  if (previousAttempt && now - previousAttempt < START_SPAM_WINDOW_MS) {
    return {
      ok: false,
      reason: "You are starting applications too quickly. Please wait a few seconds and try again."
    }
  }

  const nextAllowedAt = cooldowns.get(cooldownKey)
  if (nextAllowedAt && nextAllowedAt > now) {
    const seconds = Math.ceil((nextAllowedAt - now) / 1000)
    return {
      ok: false,
      reason: `You recently submitted this application. Try again in ${seconds}s.`
    }
  }

  startAttempts.set(cooldownKey, now)
  return { ok: true }
}

const setCooldown = ({ userId, guildId, type }) => {
  const cooldownKey = getCooldownKey(userId, guildId, type)
  cooldowns.set(cooldownKey, Date.now() + APPLICATION_COOLDOWN_MS)
}

const clearSessionTimeout = session => {
  if (session?.timeout) {
    clearTimeout(session.timeout)
  }
}

const scheduleTimeout = (userId, onTimeout) => {
  const session = activeSessions.get(userId)
  if (!session) return

  clearSessionTimeout(session)
  session.timeout = setTimeout(async () => {
    const current = activeSessions.get(userId)
    if (!current) return

    activeSessions.delete(userId)
    await onTimeout(current).catch(() => {})
  }, ACTIVE_TIMEOUT_MS)
}

const startSession = ({ userId, session, onTimeout }) => {
  activeSessions.set(userId, {
    ...session,
    startedAt: Date.now(),
    answers: [],
    index: 0,
    timeout: null
  })

  scheduleTimeout(userId, onTimeout)
  return activeSessions.get(userId)
}

const getSession = userId => activeSessions.get(userId)

const touchSession = (userId, onTimeout) => {
  scheduleTimeout(userId, onTimeout)
}

const saveAnswer = ({ userId, answer }) => {
  const session = activeSessions.get(userId)
  if (!session) return null

  const question = session.questions[session.index]
  if (!question) return null

  session.answers.push({
    key: question.key,
    prompt: question.prompt,
    answer,
    answeredAt: new Date().toISOString()
  })
  session.index += 1

  return session
}

const cancelSession = userId => {
  const session = activeSessions.get(userId)
  if (!session) return null

  clearSessionTimeout(session)
  activeSessions.delete(userId)
  return session
}

const completeSession = userId => {
  const session = cancelSession(userId)
  return session
}

module.exports = {
  canStartApplication,
  setCooldown,
  startSession,
  getSession,
  touchSession,
  saveAnswer,
  cancelSession,
  completeSession
}
