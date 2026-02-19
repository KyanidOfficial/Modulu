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

const executeEnforcement = async ({
  guildId,
  sourceUserId,
  targetId,
  directedSeverity,
  rawLevel,
  effectiveLevel,
  intent,
  globalRisk,
  deps = {}
}) => {
  const isDirected = Boolean(targetId)

  console.log("ENFORCEMENT EXECUTED", {
    level: rawLevel,
    effectiveLevel,
    targetId: targetId || null
  })

  if (isDirected && effectiveLevel >= 2 && typeof deps.onVictimProtection === "function") {
    await deps.onVictimProtection()
  }

  if (isDirected && effectiveLevel >= 3 && typeof deps.onModeratorAlert === "function") {
    await deps.onModeratorAlert({ guildId, sourceUserId, targetId, directedSeverity, intent, globalRisk, effectiveLevel })
  }

  if (effectiveLevel >= 4 && typeof deps.onFormalModeration === "function") {
    await deps.onFormalModeration({ guildId, sourceUserId, targetId, directedSeverity, intent, globalRisk, effectiveLevel })
  }
}

module.exports = {
  interventionLevel,
  executeEnforcement
}
