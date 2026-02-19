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
    lastUpdated: Date.now()
  },
  history: []
})

const ema = (prev, next, alpha) => (alpha * next) + ((1 - alpha) * prev)

const updateRiskDimension = (state, dimension, observedScore, now = Date.now(), alpha = 0.25) => {
  const current = state.dimensions[dimension] || 0
  const next = clamp01(ema(current, clamp01(observedScore), alpha))
  state.dimensions[dimension] = next

  const last = state.history[state.history.length - 1]
  const dt = Math.max(1, now - (last?.ts || now))
  const totalRisk = Object.values(state.dimensions).reduce((sum, value) => sum + value, 0)
  const prevRisk = last?.riskTotal || totalRisk
  const velocity = (totalRisk - prevRisk) / dt
  const acceleration = (velocity - (last?.velocity || 0)) / dt

  state.history.push({ ts: now, riskTotal: totalRisk, velocity })
  if (state.history.length > 30) state.history.shift()

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
