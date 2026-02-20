const interventionLevel = ({ globalRisk, directedRisk, clusterRisk, intentConfidence, thresholds }) => {
  const maxIntent = Math.max(...Object.values(intentConfidence || {}).map(v => v.confidence || 0), 0)
  const score = Math.max(globalRisk, directedRisk, clusterRisk, maxIntent)

  if (maxIntent >= thresholds.intentCritical) return 4
  if (score >= thresholds.intervention.level4) return 4
  if (score >= thresholds.intervention.level3) return 3
  if (score >= thresholds.intervention.level2) return 2
  if (score >= thresholds.intervention.level1) return 1
  return 0
}

const handleDirectedEnforcement = async ({ context, effectiveLevel, thresholds, maxEnforcementLevel, actions }) => {
  const { guildId, userId, targetId, directedSeverity, intentConfidence } = context
  const maxIntent = Math.max(...Object.values(intentConfidence || {}).map(v => v.confidence || 0), 0)

  console.log("[SIM] DIRECTED ENFORCEMENT START", {
    sourceUserId: userId,
    targetUserId: targetId,
    directedSeverity,
    effectiveLevel
  })

  const intentCriticalBreach = directedSeverity >= thresholds.intentCritical || maxIntent >= thresholds.intentCritical
  const crossedProtectionEarly = directedSeverity >= thresholds.protectionEarly

  let protectionSatisfied = false
  const actionsTaken = []

  if ((effectiveLevel >= 1 && crossedProtectionEarly) || intentCriticalBreach) {
    const result = await actions.triggerVictimProtection?.({ guildId, sourceUserId: userId, targetUserId: targetId, severity: directedSeverity, intentConfidence, effectiveLevel, force: intentCriticalBreach })
    protectionSatisfied = true
    if (result?.triggered) {
      actionsTaken.push("Victim Protection")
      console.log("PROTECTION TRIGGERED", {
        sourceUserId: userId,
        targetUserId: targetId,
        directedSeverity,
        effectiveLevel
      })
    }
  }

  if (effectiveLevel >= 2 && !protectionSatisfied) {
    const result = await actions.triggerVictimProtection?.({ guildId, sourceUserId: userId, targetUserId: targetId, severity: directedSeverity, intentConfidence, force: true, effectiveLevel })
    protectionSatisfied = true
    if (result?.triggered) {
      actionsTaken.push("Victim Protection")
      console.log("PROTECTION TRIGGERED", {
        sourceUserId: userId,
        targetUserId: targetId,
        directedSeverity,
        effectiveLevel
      })
    }
  }

  if (intentCriticalBreach) {
    await actions.notifyModerators?.({ guildId, sourceUserId: userId, targetUserId: targetId, directedSeverity, intentConfidence, critical: true })
    actionsTaken.push("Critical Moderator Alert")
  }

  if (effectiveLevel >= 3) {
    await actions.notifyModerators?.({ guildId, sourceUserId: userId, targetUserId: targetId, directedSeverity, intentConfidence })
    actionsTaken.push("Moderator Alert")
  }

  if (effectiveLevel >= 4) {
    await actions.formalModerationAction?.({ guildId, sourceUserId: userId, targetUserId: targetId, directedSeverity, intentConfidence })
    actionsTaken.push("Formal Moderation Action")
  }

  if (maxEnforcementLevel === 0 && !intentCriticalBreach) return { actionTaken: "None" }

  return { actionTaken: actionsTaken.length ? actionsTaken.join(" + ") : "None" }
}

const handleGlobalEnforcement = async ({ context, effectiveLevel, actions }) => {
  if (effectiveLevel >= 4) {
    await actions.formalModerationAction?.({
      guildId: context.guildId,
      sourceUserId: context.userId,
      targetUserId: null,
      directedSeverity: 0,
      intentConfidence: context.intentConfidence
    })

    return { actionTaken: "Formal Moderation Action" }
  }

  return { actionTaken: "None" }
}

const handleAssessment = async ({ context, level, effectiveLevel, thresholds, maxEnforcementLevel, actions = {} }) => {
  console.log("ENFORCEMENT EXECUTED", {
    level,
    effectiveLevel,
    targetId: context.targetId || null
  })

  if (context.targetId) {
    return handleDirectedEnforcement({ context, effectiveLevel, thresholds, maxEnforcementLevel, actions })
  }

  return handleGlobalEnforcement({ context, effectiveLevel, actions })
}

module.exports = {
  interventionLevel,
  handleAssessment
}
