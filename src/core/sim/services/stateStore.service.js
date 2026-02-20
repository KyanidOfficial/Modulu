const simConfig = require("../config/sim.config")
const { createUserRiskState } = require("../models/userRiskState")
const { initGuildGraph } = require("../models/guildGraph")

class SimStateStore {
  constructor(config = simConfig) {
    this.config = config
    this.userRisk = new Map()
    this.directedRisk = new Map()
    this.guildGraphs = new Map()
    this.intentByUser = new Map()
    this.intentByPair = new Map()
    this.interactionPolicies = new Map()
    this.evidenceSessions = new Map()
    this.enforcementEscalations = new Map()
    this.channelAlertState = new Map()
    this.groomingSequenceByPair = new Map()
  }

  getUserState(guildId, userId) {
    const key = `${guildId}:${userId}`
    const found = this.userRisk.get(key)
    if (found) return found

    const fresh = createUserRiskState()
    this.userRisk.set(key, fresh)
    return fresh
  }

  getDirectedMatrix(guildId) {
    if (!this.directedRisk.has(guildId)) this.directedRisk.set(guildId, new Map())
    return this.directedRisk.get(guildId)
  }

  getGuildGraph(guildId) {
    if (!this.guildGraphs.has(guildId)) this.guildGraphs.set(guildId, initGuildGraph())
    return this.guildGraphs.get(guildId)
  }

  gc(now = Date.now()) {
    const ttl = this.config.retentionMs
    for (const [key, state] of this.userRisk.entries()) {
      if (now - state.metadata.lastUpdated > ttl) this.userRisk.delete(key)
    }

    for (const [sessionId, session] of this.evidenceSessions.entries()) {
      if (now - session.updatedAt > this.config.evidenceRetentionMs) {
        this.evidenceSessions.delete(sessionId)
      }
    }

    for (const [pairKey, escalation] of this.enforcementEscalations.entries()) {
      if (now - (escalation.lastDetectionAt || 0) > ttl) {
        this.enforcementEscalations.delete(pairKey)
      }
    }

    for (const [alertKey, state] of this.channelAlertState.entries()) {
      if (now - (state.updatedAt || 0) > ttl) {
        this.channelAlertState.delete(alertKey)
      }
    }

    for (const [pairKey, list] of this.groomingSequenceByPair.entries()) {
      const active = (list || []).filter(ts => now - ts <= 10 * 60 * 1000)
      if (!active.length) {
        this.groomingSequenceByPair.delete(pairKey)
      } else {
        this.groomingSequenceByPair.set(pairKey, active)
      }
    }
  }
}

module.exports = SimStateStore
