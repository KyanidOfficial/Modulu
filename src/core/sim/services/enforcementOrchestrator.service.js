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

  console.log("DIRECTED ENFORCEMENT", {
    sourceUserId: userId,
    targetUserId: targetId,
    directedSeverity,
    effectiveLevel
  })

  const intentCriticalBreach = directedSeverity >= thresholds.intentCritical || maxIntent >= thresholds.intentCritical
  const shouldProtectEarly = (maxEnforcementLevel > 0 && directedSeverity >= thresholds.protectionEarly) || intentCriticalBreach

  if (shouldProtectEarly) {
    try {
      await actions.triggerVictimProtection?.({ guildId, sourceUserId: userId, targetUserId: targetId, severity: directedSeverity, intentConfidence })
    } catch (error) {
      console.error("[SIM] Directed victim protection failed", error)
    }
  }

  if (intentCriticalBreach) {
    await actions.notifyModerators?.({ guildId, sourceUserId: userId, targetUserId: targetId, directedSeverity, intentConfidence, critical: true })
    return
  }

  if (effectiveLevel >= 3) {
    await actions.notifyModerators?.({ guildId, sourceUserId: userId, targetUserId: targetId, directedSeverity, intentConfidence })
  }

  if (effectiveLevel >= 4) {
    await actions.formalModerationAction?.({ guildId, sourceUserId: userId, targetUserId: targetId, directedSeverity, intentConfidence })
  }
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
  }
}

const handleAssessment = async ({ context, level, effectiveLevel, thresholds, maxEnforcementLevel, actions = {} }) => {
  console.log("ENFORCEMENT EXECUTED", {
    level,
    effectiveLevel,
    targetId: context.targetId || null
  })

  if (context.targetId) {
    await handleDirectedEnforcement({ context, effectiveLevel, thresholds, maxEnforcementLevel, actions })
  } else {
    await handleGlobalEnforcement({ context, effectiveLevel, actions })
  }
}

module.exports = {
  interventionLevel,
  handleAssessment
}
