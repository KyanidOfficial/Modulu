const simConfig = require("../config/sim.config")
const { clamp01, updateRiskDimension } = require("../models/userRiskState")
const { updateDirectedRisk } = require("../models/directedRiskMatrix")
const { pushEdge } = require("../models/guildGraph")
const { debugLog } = require("../services/debugLogger.service")

class SimTestService {
  constructor(simService) {
    this.sim = simService
    this.timers = new Set()
  }

  ensureEnabled() {
    if (!this.sim || !simConfig.enabled || !simConfig.testMode) {
      throw new Error("SIM testing is disabled")
    }
  }

  async simulateRisk(guildId, userId, dimension, value) {
    this.ensureEnabled()
    const state = this.sim.store.getUserState(guildId, userId)
    updateRiskDimension(state, dimension, clamp01(value))
    debugLog("test.simulateRisk", { guildId, userId, dimension, value: clamp01(value) })
    return this.sim.evaluateAssessment({ guildId, userId, content: `[sim-test:${dimension}]` })
  }

  async simulateDirectedRisk(guildId, fromId, toId, dimension, value) {
    this.ensureEnabled()
    const matrix = this.sim.store.getDirectedMatrix(guildId)
    updateDirectedRisk(matrix, fromId, toId, { [dimension]: clamp01(value), velocity: clamp01(value) })
    debugLog("test.simulateDirectedRisk", { guildId, fromId, toId, dimension, value: clamp01(value) })
    return this.sim.evaluateAssessment({ guildId, userId: fromId, targetId: toId, content: `[sim-test:${dimension}]` })
  }

  async simulateCluster(guildId, userIds, intensity) {
    this.ensureEnabled()
    const graph = this.sim.store.getGuildGraph(guildId)
    const now = Date.now()

    for (const source of userIds) {
      for (const target of userIds) {
        if (source === target) continue
        pushEdge(graph.edges.temporalCorrelation, source, target, clamp01(intensity), now)
        pushEdge(graph.edges.lexicalSimilarity, source, target, clamp01(intensity), now)

        const state = this.sim.store.getUserState(guildId, source)
        updateRiskDimension(state, "coordinationLikelihood", clamp01(intensity), now)
      }
    }

    debugLog("test.simulateCluster", { guildId, users: userIds.length, intensity: clamp01(intensity) })

    const assessments = []
    for (const userId of userIds) {
      assessments.push(await this.sim.evaluateAssessment({ guildId, userId, content: "[sim-test:cluster]" }))
    }
    return assessments
  }

  async simulateTrajectory(guildId, userId, dimension, slope) {
    this.ensureEnabled()
    const state = this.sim.store.getUserState(guildId, userId)
    const next = clamp01((state.dimensions[dimension] || 0) + slope)
    updateRiskDimension(state, dimension, next)
    debugLog("test.simulateTrajectory", { guildId, userId, dimension, slope, next })
    return this.sim.evaluateAssessment({ guildId, userId, content: `[sim-test:trajectory:${dimension}]` })
  }

  async runGroomingScenario(guildId, attackerId, targetId) {
    this.ensureEnabled()
    const steps = [0.22, 0.38, 0.55, 0.72, 0.9]

    for (let i = 0; i < steps.length; i += 1) {
      await this.simulateDirectedRisk(guildId, attackerId, targetId, "grooming", steps[i])
      await this.simulateRisk(guildId, attackerId, "groomingProbability", steps[i])
      await new Promise(resolve => {
        const timer = setTimeout(() => {
          this.timers.delete(timer)
          resolve()
        }, 120)
        this.timers.add(timer)
      })
    }

    return this.sim.evaluateAssessment({
      guildId,
      userId: attackerId,
      targetId,
      content: "[sim-test:scenario:grooming]"
    })
  }

  dispose() {
    for (const timer of this.timers) clearTimeout(timer)
    this.timers.clear()
  }
}

module.exports = SimTestService
