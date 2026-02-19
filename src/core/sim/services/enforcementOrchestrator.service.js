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

module.exports = {
  interventionLevel
}
