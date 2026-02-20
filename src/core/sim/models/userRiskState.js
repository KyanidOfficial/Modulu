const clamp01 = value => Math.min(1, Math.max(0, Number(value) || 0))

const createUserRiskState = () => ({
  dimensions: {
    spamAggression: 0,
    groomingProbability: 0,
    harassmentEscalation: 0,
    socialEngineering: 0,
    coordinationLikelihood: 0,
    manipulationProbing: 0,
    trustStability: 0.5,
    recoveryTrend: 0.5
  },
  metadata: {
    velocity: 0,
    acceleration: 0,
    volatility: 0,
    lastUpdated: Date.now(),
    lastGroomingProbability: 0
  },
  history: []
})

const updateRiskDimension = (state, dimension, observedScore, now = Date.now()) => {
  const current = clamp01(state.dimensions[dimension] || 0)
  const dtMs = Math.max(1, now - (state.metadata.lastUpdated || now))
  const dtMinutes = Math.max(1 / 60, dtMs / 60000)
  const retained = Math.pow(0.97, dtMinutes)
  const signalWeight = clamp01(observedScore) * (1 - retained)
  const next = clamp01((current * retained) + signalWeight)
  state.dimensions[dimension] = next

  const last = state.history[state.history.length - 1]
  const dtSeconds = Math.max(1, dtMs / 1000)
  const totalRisk = Object.values(state.dimensions).reduce((sum, value) => sum + value, 0)
  const prevRisk = last?.riskTotal || totalRisk
  const velocity = (totalRisk - prevRisk) / dtSeconds
  const acceleration = (velocity - (last?.velocity || 0)) / dtSeconds

  state.history.push({ ts: now, riskTotal: totalRisk, velocity })
  if (state.history.length > 60) state.history.shift()

  const mean = state.history.reduce((sum, item) => sum + item.riskTotal, 0) / state.history.length
  const variance = state.history.reduce((sum, item) => sum + Math.pow(item.riskTotal - mean, 2), 0) / state.history.length

  state.metadata.velocity = velocity
  state.metadata.acceleration = acceleration
  state.metadata.volatility = Math.sqrt(variance)
  state.metadata.lastUpdated = now

  return state
}

module.exports = {
  clamp01,
  createUserRiskState,
  updateRiskDimension
}
