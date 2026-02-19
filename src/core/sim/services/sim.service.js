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

class SimService {
  constructor(config = simConfig) {
    this.config = config
    this.store = new SimStateStore(config)
    this.templates = loadTemplates()
    this.apiServer = null

    setInterval(() => this.store.gc(), 60 * 1000).unref()
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

    const riskResult = scoreMessageRisk({ state, message, accountAgeDays, serverTenureDays })

    const intent = scoreIntent({
      templates: this.templates,
      messageContent: message.content,
      derivativeVector: [state.metadata.velocity, state.metadata.acceleration, state.metadata.volatility]
    })

    const matrix = this.store.getDirectedMatrix(guildId)
    const targetId = message.mentions?.users?.first?.()?.id
    let directed = null

    if (this.config.featureFlags.directedModeling && targetId) {
      directed = updateDirectedRisk(matrix, userId, targetId, {
        grooming: state.dimensions.groomingProbability,
        harassment: state.dimensions.harassmentEscalation,
        manipulation: state.dimensions.manipulationProbing,
        velocity: clamp01(Math.abs(state.metadata.velocity) * 1000),
        lastInteraction: Date.now()
      })

      if (directed.grooming >= this.config.thresholds.groomingSoft && this.config.featureFlags.victimPreContact) {
        await triggerVictimProtection({ victimUser: message.mentions.users.first(), store: this.store, sourceId: userId, targetId })
      }
    }

    const graph = this.store.getGuildGraph(guildId)
    updateGraphFromMessage(graph, message)
    const cluster = await detectClusterAsync({ graph, threshold: this.config.thresholds.clusterCoordination })

    if (cluster.isCluster) {
      state.dimensions.coordinationLikelihood = clamp01(Math.max(state.dimensions.coordinationLikelihood, cluster.clusterCoefficient))
    }

    const globalRisk = clamp01(
      (state.dimensions.spamAggression +
      state.dimensions.groomingProbability +
      state.dimensions.harassmentEscalation +
      state.dimensions.socialEngineering +
      state.dimensions.coordinationLikelihood +
      state.dimensions.manipulationProbing) / 6
    )

    const level = interventionLevel({
      globalRisk,
      directedRisk: directed ? Math.max(directed.grooming, directed.harassment, directed.manipulation) : 0,
      clusterRisk: cluster.clusterCoefficient,
      intentConfidence: intent,
      thresholds: this.config.thresholds
    })

    if (level >= 3 && targetId) {
      appendEvidence({
        store: this.store,
        sessionId: `${guildId}:${userId}:${targetId}`,
        payload: {
          messageContent: String(message.content || ""),
          timestamp: message.createdTimestamp || Date.now(),
          channelId: message.channel.id,
          directedPair: `${userId}->${targetId}`
        }
      })
    }

    this.store.intentByUser.set(`${guildId}:${userId}`, intent)
    if (targetId) this.store.intentByPair.set(`${guildId}:${userId}->${targetId}`, intent)

    return { globalRisk, level, intent, directed, cluster, state: riskResult.state }
  }

  getUserReport(guildId, userId) {
    const state = this.store.userRisk.get(`${guildId}:${userId}`) || null
    const intent = this.store.intentByUser.get(`${guildId}:${userId}`) || {}
    const directed = this.store.getDirectedMatrix(guildId)
    return { state, velocity: state?.metadata, intent, directedRisks: [...directed.entries()].filter(([pair]) => pair.startsWith(`${userId}->`)) }
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
    if (!this.config.api.enabled || this.apiServer) return
    this.apiServer = startModeratorApi({ simService: this, port: this.config.api.port })
  }
}

module.exports = SimService
