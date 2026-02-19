const simConfig = require("../config/sim.config")
const SimStateStore = require("./stateStore.service")
const { loadTemplates } = require("./templateRegistry.service")
const { scoreMessageRisk } = require("../engines/riskTensor.engine")
const { scoreIntent } = require("../engines/intentInference.engine")
const { updateDirectedRisk } = require("../models/directedRiskMatrix")
const { updateGraphFromMessage, detectClusterAsync } = require("../engines/graphIntelligence.engine")
const { triggerVictimProtection } = require("./victimProtection.service")
const { appendEvidence, exportEvidence } = require("./evidenceIntegrity.service")
const { interventionLevel } = require("./enforcementOrchestrator.service")
const { clamp01 } = require("../models/userRiskState")
const { startModeratorApi } = require("./moderatorApi.service")
const { debugLog } = require("./debugLogger.service")
const { normalizeDirectedRisk } = require("../utils/normalizeDirectedRisk")

class SimService {
  constructor(config = simConfig) {
    this.config = config
    this.store = new SimStateStore(config)
    this.templates = loadTemplates()
    this.apiServer = null

    setInterval(() => this.store.gc(), 60 * 1000).unref()
  }

  async evaluateAssessment({ guildId, userId, targetId = null, victimUser = null, content = "", channelId = null, createdAt = Date.now() }) {
    const state = this.store.getUserState(guildId, userId)
    const intent = scoreIntent({
      templates: this.templates,
      messageContent: content,
      derivativeVector: [state.metadata.velocity, state.metadata.acceleration, state.metadata.volatility]
    })

    const directedMatrix = this.store.getDirectedMatrix(guildId)
    const directed = targetId ? directedMatrix.get(`${userId}->${targetId}`) || null : null

    const graph = this.store.getGuildGraph(guildId)
    const cluster = await detectClusterAsync({ graph, threshold: this.config.thresholds.clusterCoordination })

    if (cluster.isCluster) {
      state.dimensions.coordinationLikelihood = clamp01(Math.max(state.dimensions.coordinationLikelihood, cluster.clusterCoefficient))
      debugLog("cluster.detected", { guildId, userId, clusterCoefficient: cluster.clusterCoefficient })
    }

    const globalRisk = clamp01(
      (state.dimensions.spamAggression +
        state.dimensions.groomingProbability +
        state.dimensions.harassmentEscalation +
        state.dimensions.socialEngineering +
        state.dimensions.coordinationLikelihood +
        state.dimensions.manipulationProbing) / 6
    )

    const directedSeverity = normalizeDirectedRisk(directed)
    const maxIntent = Math.max(...Object.values(intent || {}).map(v => v.confidence || 0), 0)

    console.log("INTERVENTION INPUTS", {
      globalRisk,
      directedSeverity,
      clusterRisk: cluster.clusterCoefficient,
      maxIntent
    })

    const rawLevel = interventionLevel({
      globalRisk,
      directedRisk: directedSeverity,
      clusterRisk: cluster.clusterCoefficient,
      intentConfidence: intent,
      thresholds: this.config.thresholds
    })

    const level = Math.min(rawLevel, this.config.maxEnforcementLevel)
    this.store.intentByUser.set(`${guildId}:${userId}`, intent)
    if (targetId) this.store.intentByPair.set(`${guildId}:${userId}->${targetId}`, intent)

    debugLog("assessment.updated", {
      guildId,
      userId,
      targetId,
      globalRisk,
      rawLevel,
      effectiveLevel: level,
      velocity: state.metadata.velocity,
      acceleration: state.metadata.acceleration
    })


    if (
      targetId &&
      directedSeverity >= this.config.thresholds.intervention.level2 &&
      level >= 2 &&
      this.config.featureFlags.victimPreContact
    ) {
      await triggerVictimProtection({ guildId, victimUser, store: this.store, sourceId: userId, targetId })
    }

    if (level >= 3 && targetId && channelId) {
      appendEvidence({
        store: this.store,
        sessionId: `${guildId}:${userId}:${targetId}`,
        payload: {
          messageContent: String(content || ""),
          timestamp: createdAt,
          channelId,
          directedPair: `${userId}->${targetId}`
        }
      })
    }

    return { globalRisk, rawLevel, level, intent, directed, cluster, state }
  }

  async handleMessage(message) {
    if (!this.config.enabled || !message.guild || message.author?.bot) return null

    const guildId = message.guild.id
    const userId = message.author.id
    const state = this.store.getUserState(guildId, userId)

    const accountAgeDays = (Date.now() - message.author.createdTimestamp) / (1000 * 60 * 60 * 24)
    const serverTenureDays = message.member?.joinedTimestamp
      ? (Date.now() - message.member.joinedTimestamp) / (1000 * 60 * 60 * 24)
      : 0

    scoreMessageRisk({ state, message, accountAgeDays, serverTenureDays })
    debugLog("risk.dimension.update", {
      guildId,
      userId,
      spamAggression: state.dimensions.spamAggression,
      groomingProbability: state.dimensions.groomingProbability,
      harassmentEscalation: state.dimensions.harassmentEscalation,
      coordinationLikelihood: state.dimensions.coordinationLikelihood
    })

    const targetId = message.mentions?.users?.first?.()?.id || null
    const matrix = this.store.getDirectedMatrix(guildId)

    if (this.config.featureFlags.directedModeling && targetId) {
      const directed = updateDirectedRisk(matrix, userId, targetId, {
        grooming: state.dimensions.groomingProbability,
        harassment: state.dimensions.harassmentEscalation,
        manipulation: state.dimensions.manipulationProbing,
        velocity: clamp01(Math.abs(state.metadata.velocity) * 1000),
        lastInteraction: Date.now()
      })

      debugLog("directed.update", {
        guildId,
        fromId: userId,
        toId: targetId,
        grooming: directed.grooming,
        harassment: directed.harassment,
        manipulation: directed.manipulation
      })

    }

    const graph = this.store.getGuildGraph(guildId)
    updateGraphFromMessage(graph, message)

    return this.evaluateAssessment({
      guildId,
      userId,
      targetId,
      victimUser: message.mentions?.users?.first?.() || null,
      content: message.content,
      channelId: message.channel?.id,
      createdAt: message.createdTimestamp || Date.now()
    })
  }

  resetUserState(guildId, userId) {
    this.store.userRisk.delete(`${guildId}:${userId}`)
    this.store.intentByUser.delete(`${guildId}:${userId}`)

    const matrix = this.store.getDirectedMatrix(guildId)
    for (const key of matrix.keys()) {
      if (key.startsWith(`${userId}->`) || key.endsWith(`->${userId}`)) {
        matrix.delete(key)
      }
    }
  }

  getUserReport(guildId, userId) {
    const state = this.store.userRisk.get(`${guildId}:${userId}`) || null
    const intent = this.store.intentByUser.get(`${guildId}:${userId}`) || {}
    const directed = this.store.getDirectedMatrix(guildId)
    return {
      state,
      velocity: state?.metadata,
      intent,
      effectiveEnforcementCap: this.config.maxEnforcementLevel,
      directedRisks: [...directed.entries()].filter(([pair]) => pair.startsWith(`${userId}->`))
    }
  }

  getClusterReport(guildId) {
    const graph = this.store.guildGraphs.get(guildId)
    if (!graph) return { nodes: 0, edges: 0 }

    const edgeCount = Object.values(graph.edges).reduce((sum, edgeMap) => sum + edgeMap.size, 0)
    return {
      nodes: graph.nodes.users.size + graph.nodes.channels.size,
      edges: edgeCount
    }
  }

  getEvidence(sessionId) {
    return exportEvidence(this.store, sessionId)
  }

  startApiIfEnabled() {
    if (!this.config.enabled || !this.config.api.enabled || this.apiServer) return
    this.apiServer = startModeratorApi({ simService: this, port: this.config.api.port })
  }
}

module.exports = SimService
