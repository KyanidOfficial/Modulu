const { clamp01 } = require("./userRiskState")

const createDirectedRisk = () => ({
  grooming: 0,
  harassment: 0,
  manipulation: 0,
  velocity: 0,
  lastInteraction: 0
})

const keyForPair = (sourceUserId, targetUserId) => `${sourceUserId}->${targetUserId}`

const updateDirectedRisk = (matrix, sourceUserId, targetUserId, patch = {}) => {
  const key = keyForPair(sourceUserId, targetUserId)
  const previous = matrix.get(key) || createDirectedRisk()
  const next = {
    grooming: clamp01(patch.grooming ?? previous.grooming),
    harassment: clamp01(patch.harassment ?? previous.harassment),
    manipulation: clamp01(patch.manipulation ?? previous.manipulation),
    velocity: clamp01(patch.velocity ?? previous.velocity),
    lastInteraction: patch.lastInteraction || Date.now()
  }

  matrix.set(key, next)
  return next
}

module.exports = {
  createDirectedRisk,
  keyForPair,
  updateDirectedRisk
}
