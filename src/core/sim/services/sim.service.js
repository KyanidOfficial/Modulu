const simConfig = require("../config/sim.config")
const SimStateStore = require("./stateStore.service")
const { loadTemplates } = require("./templateRegistry.service")
const { scoreMessageRisk } = require("../engines/riskTensor.engine")
const { scoreIntent } = require("../engines/intentInference.engine")
const { updateDirectedRisk } = require("../models/directedRiskMatrix")
const { updateGraphFromMessage, detectClusterAsync } = require("../engines/graphIntelligence.engine")
const { buildNeutralNotice, triggerVictimProtection } = require("./victimProtection.service")
const { appendEvidence, exportEvidence } = require("./evidenceIntegrity.service")
const { interventionLevel, handleAssessment } = require("./enforcementOrchestrator.service")
const { clamp01 } = require("../models/userRiskState")
const { startModeratorApi } = require("./moderatorApi.service")
const { debugLog } = require("./debugLogger.service")
const { normalizeDirectedRisk } = require("../utils/normalizeDirectedRisk")

const PRIVATE_MOVE_PATTERNS = [
  /\bdm\b/i,
  /private/i,
  /somewhere else/i,
  /don'?t tell/i,
  /just between us/i,
  /trust me/i
]

const GROOMING_CATEGORIES = {
  trust_building: [/special connection/i, /understand me better/i, /only one who/i],
  isolation: [/don'?t tell/i, /just between us/i, /nobody needs to know/i],
  private_move: [/\bdm\b/i, /private/i, /somewhere else/i],
  pressure: [/don't you trust me/i, /after everything I shared/i]
}

class SimService {
  constructor(config = simConfig) {
    this.config = config
    this.store = new SimStateStore(config)
    this.templates = loadTemplates()
    this.apiServer = null

    setInterval(() => this.store.gc(), 60 * 1000).unref()
  }

  applyPairEscalation({ guildId, userId, targetId, effectiveLevel }) {
    if (!targetId) return effectiveLevel

    const now = Date.now()
    const pairKey = `${guildId}:${userId}->${targetId}`
    const existing = this.store.enforcementEscalations.get(pairKey) || { bump: 0, lastDetectionAt: 0 }
    const repeatedWithinWindow = now - (existing.lastDetectionAt || 0) <= 10 * 60 * 1000

    let bump = existing.bump || 0
    if (repeatedWithinWindow) {
      bump = Math.min(4, bump + 1)
      console.log(`[SIM] Escalation applied newLevel=${Math.min(4, effectiveLevel + bump)}`)
    }

    this.store.enforcementEscalations.set(pairKey, {
      bump,
      lastDetectionAt: now
    })

    return Math.min(4, effectiveLevel + bump)
  }

  applyDirectedOverrides({ directedSeverity, groomingRising, effectiveLevel }) {
    let nextLevel = effectiveLevel
    let overridden = false

    if (directedSeverity > 0.05 && groomingRising) {
      nextLevel = Math.max(nextLevel, 2)
      overridden = true
    }
    if (directedSeverity > 0.10) {
      nextLevel = Math.max(nextLevel, 3)
      overridden = true
    }
    if (directedSeverity > 0.18) {
      nextLevel = 4
      overridden = true
    }

    if (overridden) {
      console.log(`[SIM] Directed override applied level=${nextLevel}`)
    }

    return { level: nextLevel, overridden }
  }

  shouldDispatchChannelAlert({ guildId, sourceUserId, targetUserId, effectiveLevel }) {
    const alertKey = `${guildId}:${sourceUserId}->${targetUserId || "none"}`
    const existing = this.store.channelAlertState.get(alertKey) || { level: 0 }
    if (effectiveLevel <= existing.level) return false
    this.store.channelAlertState.set(alertKey, {
      level: effectiveLevel,
      updatedAt: Date.now()
    })
    return true
  }

  getMessageDelayMsForUser(guildId, userId) {
    let highest = 0
    for (const [pairKey, policy] of this.store.interactionPolicies.entries()) {
      if (!pairKey.startsWith(`${userId}->`)) continue
      highest = Math.max(highest, Number(policy?.messageDelayMs || 0))
    }
    return highest
  }

  applyVictimButtonAction({ customId, actorUserId }) {
    const parts = String(customId || "").split(":")
    if (parts[0] !== "sim" || parts.length < 4) return { handled: false }

    const action = parts[1]
    const sourceId = parts[2]
    const targetId = parts[3]
    if (!sourceId || !targetId || actorUserId !== targetId) {
      return { handled: true, message: "You can only manage protections for your own SIM alert." }
    }

    const key = `${sourceId}->${targetId}`
    const existing = this.store.interactionPolicies.get(key) || {
      restrictDMs: false,
      filterLinks: false,
      messageDelayMs: 0,
      forceModeratedChannel: false,
      activatedByVictim: false
    }

    const next = {
      ...existing,
      activatedByVictim: true,
      updatedAt: Date.now()
    }

    let message = "No action applied."
    let shieldEnabled = Boolean(existing.restrictDMs)

    if (action === "shield") {
      shieldEnabled = !Boolean(existing.restrictDMs)
      next.restrictDMs = shieldEnabled
      message = shieldEnabled ? "Interaction shield enabled." : "Interaction shield disabled."
    } else if (action === "report") {
      next.forceModeratedChannel = true
      message = "Silent report signal submitted."
    }

    this.store.interactionPolicies.set(key, next)

    return {
      handled: true,
      message,
      action,
      sourceId,
      targetId,
      shieldEnabled,
      notice: buildNeutralNotice({ shieldEnabled, sourceId, targetId })
    }
  }

  analyzeGroomingSignals(content = "") {
    const text = String(content || "")
    const matched = []
    const categoryMatches = new Set()

    for (const [category, patterns] of Object.entries(GROOMING_CATEGORIES)) {
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          matched.push(pattern.source)
          categoryMatches.add(category)
        }
      }
    }

    let increment = matched.length * 0.04
    if (categoryMatches.size >= 2) increment += 0.08

    return {
      matched,
      categoryCount: categoryMatches.size,
      increment,
      hasPrivateMove: PRIVATE_MOVE_PATTERNS.some(pattern => pattern.test(text))
    }
  }

  applyGroomingSequenceStacking({ guildId, sourceUserId, targetUserId, now, state, signalCount }) {
    if (!targetUserId || signalCount <= 0) return 1

    const pairKey = `${guildId}:${sourceUserId}->${targetUserId}`
    const current = this.store.groomingSequenceByPair.get(pairKey) || []
    const additions = Array.from({ length: signalCount }, () => now)
    const active = [...current.filter(ts => now - ts <= 10 * 60 * 1000), ...additions]
    this.store.groomingSequenceByPair.set(pairKey, active)

    const withinFive = active.filter(ts => now - ts <= 5 * 60 * 1000).length

    if (active.length >= 5) {
      state.dimensions.groomingProbability = clamp01(state.dimensions.groomingProbability * 2.5)
      console.log("[SIM] Grooming sequence multiplier applied")
      return 2.5
    }

    if (withinFive >= 3) {
      state.dimensions.groomingProbability = clamp01(state.dimensions.groomingProbability * 1.8)
      console.log("[SIM] Grooming sequence multiplier applied")
      return 1.8
    }

    return 1
  }

  async resolveTargetUser(message) {
    const sourceUserId = message.author?.id
    if (!sourceUserId) return { targetId: null, reason: "none" }

    const mentioned = message.mentions?.users?.find?.(user => user.id !== sourceUserId)
    if (mentioned) {
      return { targetId: mentioned.id, reason: "mention" }
    }

    if (message.reference?.messageId) {
      const referenced = await message.channel?.messages?.fetch?.(message.reference.messageId).catch(() => null)
      const referencedUserId = referenced?.author?.id
      if (referencedUserId && referencedUserId !== sourceUserId && !referenced?.author?.bot) {
        return { targetId: referencedUserId, reason: "reply" }
      }
    }

    const recent = this.store.lastDirectedInteraction.get(sourceUserId)
    if (recent && recent.targetId && recent.targetId !== sourceUserId && Date.now() - recent.timestamp < 5 * 60 * 1000) {
      return { targetId: recent.targetId, reason: "recent_pair" }
    }

    const recentMessages = await message.channel?.messages?.fetch?.({ limit: 10 }).catch(() => null)
    if (recentMessages?.size) {
      const humanIds = new Set()
      for (const m of recentMessages.values()) {
        if (!m.author?.bot && m.author?.id) humanIds.add(m.author.id)
      }

      if (humanIds.size === 2 && humanIds.has(sourceUserId)) {
        const otherId = [...humanIds].find(id => id !== sourceUserId) || null
        if (otherId) return { targetId: otherId, reason: "channel_pair" }
      }
    }

    return { targetId: null, reason: "none" }
  }

  createAggressorLock({ sourceUserId, targetUserId, now = Date.now() }) {
    if (!sourceUserId || !targetUserId || sourceUserId === targetUserId) return

    const pairKey = `${sourceUserId}->${targetUserId}`
    this.store.activeAggressors.set(pairKey, {
      aggressorId: sourceUserId,
      victimId: targetUserId,
      expiresAt: now + (10 * 60 * 1000)
    })

    console.log("[SIM] Aggressor lock created", {
      aggressorId: sourceUserId,
      victimId: targetUserId
    })
  }

  async sendSimAlertMessage({ channel, sourceUserId, targetUserId, globalRisk, directedSeverity, maxIntent, rawLevel, effectiveLevel, actionTaken }) {
    if (!channel?.isTextBased?.() || typeof channel.send !== "function") return

    if (!this.shouldDispatchChannelAlert({
      guildId: channel.guild?.id || "dm",
      sourceUserId,
      targetUserId,
      effectiveLevel
    })) return

    const targetLine = targetUserId ? `<@${targetUserId}>` : "None"
    const lines = [
      "SIM ALERT",
      `Source: <@${sourceUserId}>`,
      `Target: ${targetLine}`,
      `GlobalRisk: ${Number(globalRisk || 0).toFixed(3)}`,
      `DirectedSeverity: ${Number(directedSeverity || 0).toFixed(3)}`,
      `Intent: ${Number(maxIntent || 0).toFixed(3)}`,
      `RawLevel: ${rawLevel}`,
      `EffectiveLevel: ${effectiveLevel}`,
      `Action: ${actionTaken || "None"}`
    ]

    Promise.resolve(
      channel.send({ content: lines.join("\n") })
    ).catch(error => {
      console.error("[SIM] Failed to send in-channel alert", {
        channelId: channel?.id,
        error: error?.message
      })
    })

    console.log("[SIM] Channel alert sent", {
      channelId: channel.id,
      sourceUserId,
      targetUserId,
      effectiveLevel
    })
  }

  async evaluateAssessment({ guildId, userId, targetId = null, victimUser = null, client = null, content = "", channelId = null, channel = null, createdAt = Date.now(), groomingMatchedPhrases = [], effectiveScore = 0 }) {
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
    const gatedClusterRisk = cluster.clusterCoefficient > 0.35 ? cluster.clusterCoefficient : 0
    const score = Math.max(globalRisk, maxIntent, gatedClusterRisk, directedSeverity * 1.6)

    const rawLevel = interventionLevel({
      globalRisk,
      directedRisk: directedSeverity,
      clusterRisk: cluster.clusterCoefficient,
      intentConfidence: intent,
      thresholds: this.config.thresholds,
      velocity: state.metadata.velocity,
      acceleration: state.metadata.acceleration
    })

    const baseEnforcementLevel = this.config.baseEnforcementLevel ?? this.config.maxEnforcementLevel
    const dynamicCap = directedSeverity >= this.config.thresholds.intentCritical
      ? 4
      : directedSeverity >= this.config.thresholds.intervention.level3
        ? Math.max(baseEnforcementLevel, 3)
        : baseEnforcementLevel

    let level = Math.min(rawLevel, dynamicCap)
    level = this.applyPairEscalation({ guildId, userId, targetId, effectiveLevel: level })

    const groomingRising = state.dimensions.groomingProbability > Number(state.metadata.lastGroomingProbability || 0)
    const overrideResult = this.applyDirectedOverrides({ directedSeverity, groomingRising, effectiveLevel: level })
    level = overrideResult.overridden ? overrideResult.level : Math.min(overrideResult.level, dynamicCap)

    this.store.intentByUser.set(`${guildId}:${userId}`, intent)
    if (targetId) this.store.intentByPair.set(`${guildId}:${userId}->${targetId}`, intent)

    if (this.config.debug || process.env.SIM_DEBUG_VERBOSE === "true") {
      console.log("[SIM] Verbose assessment", {
        guildId,
        sourceUserId: userId,
        targetUserId: targetId,
        globalRisk,
        directedSeverity,
        clusterRisk: cluster.clusterCoefficient,
        maxIntent,
        rawLevel,
        effectiveLevel: level,
        dynamicCap,
        velocity: state.metadata.velocity,
        acceleration: state.metadata.acceleration
      })
    }

    debugLog("assessment.updated", {
      guildId,
      userId,
      targetId,
      globalRisk,
      rawLevel,
      dynamicCap,
      effectiveLevel: level,
      velocity: state.metadata.velocity,
      acceleration: state.metadata.acceleration
    })

    if (level >= 2) {
      console.log("[SIM] Grooming analysis:", {
        phrasesMatched: groomingMatchedPhrases,
        groomingProbability: state.dimensions.groomingProbability,
        directedSeverity,
        score: effectiveScore || score,
        rawLevel,
        effectiveLevel: level
      })
    }

    let actionTaken = "None"

    try {
      const result = await handleAssessment({
        context: {
          guildId,
          userId,
          targetId,
          directedSeverity,
          intentConfidence: intent
        },
        level: rawLevel,
        effectiveLevel: level,
        thresholds: this.config.thresholds,
        maxEnforcementLevel: dynamicCap,
        actions: {
          triggerVictimProtection: async ({ guildId: gId, sourceUserId, targetUserId, severity, intentConfidence, force = false, effectiveLevel = null }) => {
            if (!this.config.featureFlags.victimPreContact) return false

            console.log("[SIM] Victim fetch attempt", { guildId: gId, targetUserId })
            const resolvedVictimUser = await client?.users?.fetch?.(targetUserId).then(user => {
              console.log("[SIM] Victim fetch success", { guildId: gId, targetUserId })
              return user
            }).catch(err => {
              console.error("[SIM] Victim fetch failed", {
                guildId: gId,
                targetId: targetUserId,
                error: err?.message
              })
              return null
            })

            const resolvedVictim = resolvedVictimUser || victimUser || null

            if (!resolvedVictim) return { triggered: false, reason: "victim_unresolved" }

            return triggerVictimProtection({
              guildId: gId,
              victimUser: resolvedVictim,
              store: this.store,
              sourceId: sourceUserId,
              targetId: targetUserId,
              severity,
              intentConfidence,
              logChannelId: this.config.logChannelId,
              cooldownMs: force ? 0 : this.config.protectionCooldownMs,
              force,
              effectiveLevel
            })
          },
          notifyModerators: payload => this.notifyModerators(payload),
          formalModerationAction: payload => this.formalModerationAction(payload)
        }
      })

      actionTaken = result?.actionTaken || "None"
    } catch (error) {
      console.error("[SIM] enforcement failed", error)
    }

    if (level >= 2) {
      this.sendSimAlertMessage({
        channel,
        sourceUserId: userId,
        targetUserId: targetId,
        globalRisk,
        directedSeverity,
        maxIntent,
        rawLevel,
        effectiveLevel: level,
        actionTaken
      })
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

    state.metadata.lastGroomingProbability = state.dimensions.groomingProbability

    return { globalRisk, rawLevel, level, intent, directed, cluster, state }
  }

  async handleMessage(message) {
    if (!this.config.enabled || !message.guild || message.author?.bot) return null

    const guildId = message.guild.id
    const sourceUserId = message.author.id
    const state = this.store.getUserState(guildId, sourceUserId)

    const attribution = await this.resolveTargetUser(message)
    const targetUserId = attribution.targetId && attribution.targetId !== sourceUserId ? attribution.targetId : null

    console.log("[SIM] Attribution resolved", {
      source: sourceUserId,
      target: targetUserId,
      reason: attribution.reason
    })

    if (targetUserId) {
      this.store.lastDirectedInteraction.set(sourceUserId, {
        targetId: targetUserId,
        timestamp: Date.now()
      })
    }

    let victimReplyLockActive = false
    if (targetUserId) {
      const reverseKey = `${targetUserId}->${sourceUserId}`
      const reverseLock = this.store.activeAggressors.get(reverseKey)
      if (reverseLock) {
        if (Date.now() >= reverseLock.expiresAt) {
          this.store.activeAggressors.delete(reverseKey)
          console.log("[SIM] Lock expired", {
            aggressorId: reverseLock.aggressorId,
            victimId: reverseLock.victimId
          })
        } else {
          console.log("[SIM] Aggressor lock active", {
            aggressorId: reverseLock.aggressorId,
            victimId: reverseLock.victimId
          })
          if (sourceUserId !== reverseLock.aggressorId) {
            victimReplyLockActive = true
            console.log("[SIM] Victim reply detected. Grooming scoring skipped.")
          }
        }
      }
    }

    const accountAgeDays = (Date.now() - message.author.createdTimestamp) / (1000 * 60 * 60 * 24)
    const serverTenureDays = message.member?.joinedTimestamp
      ? (Date.now() - message.member.joinedTimestamp) / (1000 * 60 * 60 * 24)
      : 0

    const previousGrooming = state.dimensions.groomingProbability
    scoreMessageRisk({ state, message, accountAgeDays, serverTenureDays })

    const grooming = this.analyzeGroomingSignals(message.content)

    if (!victimReplyLockActive && grooming.increment > 0) {
      state.dimensions.groomingProbability = clamp01(state.dimensions.groomingProbability + grooming.increment)
      console.log("[SIM] Grooming scoring applied to aggressor", {
        sourceUserId,
        targetUserId,
        increment: grooming.increment
      })
    }

    if (victimReplyLockActive) {
      state.dimensions.groomingProbability = previousGrooming
    } else {
      this.applyGroomingSequenceStacking({
        guildId,
        sourceUserId,
        targetUserId,
        now: message.createdTimestamp || Date.now(),
        state,
        signalCount: grooming.matched.length
      })
    }

    debugLog("risk.dimension.update", {
      guildId,
      userId: sourceUserId,
      spamAggression: state.dimensions.spamAggression,
      groomingProbability: state.dimensions.groomingProbability,
      harassmentEscalation: state.dimensions.harassmentEscalation,
      coordinationLikelihood: state.dimensions.coordinationLikelihood
    })

    const matrix = this.store.getDirectedMatrix(guildId)

    if (this.config.featureFlags.directedModeling && targetUserId && !victimReplyLockActive) {
      const pairKey = `${sourceUserId}->${targetUserId}`
      const previousDirectedSeverity = normalizeDirectedRisk(matrix.get(pairKey) || null)

      let directedGrooming = state.dimensions.groomingProbability

      if (state.dimensions.groomingProbability > 0.05) {
        directedGrooming = clamp01(directedGrooming + (state.dimensions.groomingProbability * 0.6))
      }

      if (grooming.hasPrivateMove) {
        directedGrooming = clamp01(directedGrooming + 0.15)
        console.log("[SIM] Private move spike applied")
      }

      const directed = updateDirectedRisk(matrix, sourceUserId, targetUserId, {
        grooming: directedGrooming,
        harassment: state.dimensions.harassmentEscalation,
        manipulation: state.dimensions.manipulationProbing,
        velocity: clamp01(Math.abs(state.metadata.velocity)),
        lastInteraction: Date.now()
      })

      const directedSeverity = normalizeDirectedRisk(directed)

      console.log("[SIM] Directed severity updated", {
        sourceUserId,
        targetUserId,
        directedSeverity
      })

      if (grooming.increment > 0.03 || directedSeverity > previousDirectedSeverity) {
        this.createAggressorLock({ sourceUserId, targetUserId, now: Date.now() })
      }

      debugLog("directed.update", {
        guildId,
        fromId: sourceUserId,
        toId: targetUserId,
        grooming: directed.grooming,
        harassment: directed.harassment,
        manipulation: directed.manipulation
      })
    }

    state.metadata.lastGroomingProbability = previousGrooming

    const graph = this.store.getGuildGraph(guildId)
    updateGraphFromMessage(graph, message)

    const directed = targetUserId ? matrix.get(`${sourceUserId}->${targetUserId}`) : null
    const directedSeverity = normalizeDirectedRisk(directed)
    const globalRisk = clamp01(
      (state.dimensions.spamAggression +
        state.dimensions.groomingProbability +
        state.dimensions.harassmentEscalation +
        state.dimensions.socialEngineering +
        state.dimensions.coordinationLikelihood +
        state.dimensions.manipulationProbing) / 6
    )
    const maxIntent = Math.max(...Object.values(scoreIntent({
      templates: this.templates,
      messageContent: message.content,
      derivativeVector: [state.metadata.velocity, state.metadata.acceleration, state.metadata.volatility]
    }) || {}).map(v => v.confidence || 0), 0)
    const clusterRisk = 0
    const effectiveScore = Math.max(globalRisk, maxIntent, clusterRisk > 0.35 ? clusterRisk : 0, directedSeverity * 1.6)

    return this.evaluateAssessment({
      guildId,
      userId: sourceUserId,
      targetId: targetUserId,
      victimUser: targetUserId ? await message.client.users.fetch(targetUserId).catch(() => null) : null,
      client: message.client || null,
      content: message.content,
      channelId: message.channel?.id,
      channel: message.channel || null,
      createdAt: message.createdTimestamp || Date.now(),
      groomingMatchedPhrases: grooming.matched,
      effectiveScore
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
      effectiveEnforcementCap: this.config.baseEnforcementLevel ?? this.config.maxEnforcementLevel,
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

  async notifyModerators({ guildId, sourceUserId, targetUserId, directedSeverity, intentConfidence }) {
    const maxIntent = Math.max(...Object.values(intentConfidence || {}).map(v => v.confidence || 0), 0)
    debugLog("moderator.alert", {
      guildId,
      sourceUserId,
      targetUserId,
      directedSeverity,
      maxIntent
    })
  }

  async formalModerationAction({ guildId, sourceUserId, targetUserId, directedSeverity, intentConfidence }) {
    const maxIntent = Math.max(...Object.values(intentConfidence || {}).map(v => v.confidence || 0), 0)
    debugLog("moderation.action", {
      guildId,
      sourceUserId,
      targetUserId,
      directedSeverity,
      maxIntent,
      mode: "sim_stub"
    })
  }

  startApiIfEnabled() {
    if (!this.config.enabled || !this.config.api.enabled || this.apiServer) return
    this.apiServer = startModeratorApi({ simService: this, port: this.config.api.port })
  }
}

module.exports = SimService
