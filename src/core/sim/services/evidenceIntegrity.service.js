const crypto = require("crypto")

const hashEntry = entry => crypto.createHash("sha256").update(JSON.stringify(entry)).digest("hex")

const appendEvidence = ({ store, sessionId, payload }) => {
  const session = store.evidenceSessions.get(sessionId) || {
    sessionId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    entries: [],
    status: "active"
  }

  const prevHash = session.entries[session.entries.length - 1]?.hash || "GENESIS"
  const entry = {
    messageContent: payload.messageContent,
    timestamp: payload.timestamp,
    channelId: payload.channelId,
    directedPair: payload.directedPair,
    prevHash
  }

  const hash = hashEntry(entry)
  session.entries.push({ ...entry, hash })
  session.updatedAt = Date.now()
  store.evidenceSessions.set(sessionId, session)

  return session
}

const exportEvidence = (store, sessionId) => store.evidenceSessions.get(sessionId) || null

module.exports = {
  appendEvidence,
  exportEvidence
}
