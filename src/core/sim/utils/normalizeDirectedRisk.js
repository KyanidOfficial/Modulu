const clamp01 = value => Math.min(1, Math.max(0, Number(value) || 0))

const normalizeDirectedRisk = directedRiskObject => {
  if (!directedRiskObject || typeof directedRiskObject !== "object") return 0

  const grooming = clamp01(directedRiskObject.grooming)
  const harassment = clamp01(directedRiskObject.harassment)
  const manipulation = clamp01(directedRiskObject.manipulation)

  return Math.max(grooming, harassment, manipulation)
}

module.exports = {
  normalizeDirectedRisk
}
