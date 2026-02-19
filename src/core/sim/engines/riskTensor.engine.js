const { updateRiskDimension, clamp01 } = require("../models/userRiskState")

const toFeatures = message => {
  const content = String(message.content || "")
  const lower = content.toLowerCase()
  return {
    spamAggression: clamp01((content.length > 250 ? 0.15 : 0) + (message.mentions?.users?.size > 3 ? 0.25 : 0)),
    groomingProbability: clamp01(/secret|dm me|dont tell|private/i.test(lower) ? 0.55 : 0.05),
    harassmentEscalation: clamp01(/idiot|stupid|hate|kill yourself/i.test(lower) ? 0.6 : 0.04),
    socialEngineering: clamp01(/verify|password|code|otp|wallet/i.test(lower) ? 0.7 : 0.03),
    coordinationLikelihood: clamp01(/raid|everyone spam|join now|mass ping/i.test(lower) ? 0.65 : 0.05),
    manipulationProbing: clamp01(/trust me|prove loyalty|if you care/i.test(lower) ? 0.5 : 0.03)
  }
}

const applyTrustAndRecovery = (state, accountAgeDays, serverTenureDays) => {
  const positiveInteractions = Math.max(0, 1 - state.dimensions.harassmentEscalation)
  const recoveryTrend = 1 / (1 + Math.exp(-4 * (positiveInteractions - 0.5)))

  const trustBase = clamp01((accountAgeDays / 365) * 0.35 + (serverTenureDays / 180) * 0.35 + positiveInteractions * 0.2 + recoveryTrend * 0.1)
  const anomalySpike = state.metadata.velocity > 0.0015 || state.metadata.acceleration > 0.0001
  const trustStability = clamp01(anomalySpike ? trustBase * 0.85 : trustBase)

  state.dimensions.trustStability = trustStability
  state.dimensions.recoveryTrend = clamp01((state.dimensions.recoveryTrend * 0.7) + (recoveryTrend * 0.3))
}

const scoreMessageRisk = ({ state, message, now = Date.now(), accountAgeDays = 30, serverTenureDays = 14 }) => {
  const features = toFeatures(message)

  for (const [dimension, score] of Object.entries(features)) {
    updateRiskDimension(state, dimension, score, now)
  }

  applyTrustAndRecovery(state, accountAgeDays, serverTenureDays)

  return {
    state,
    features
  }
}

module.exports = {
  scoreMessageRisk
}
