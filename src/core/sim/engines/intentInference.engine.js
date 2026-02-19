const { cosineSimilarity } = require("../models/guildGraph")
const { clamp01 } = require("../models/userRiskState")

const sigmoid = x => 1 / (1 + Math.exp(-x))

const stageSignals = {
  grooming: [/trust/i, /private/i, /secret/i, /dm/i, /don't tell|dont tell/i],
  scam: [/verify/i, /code/i, /gift/i, /wallet/i, /urgent/i],
  harassmentEscalation: [/idiot|loser|stupid/i, /shut up/i, /threat/i, /hate/i]
}

const scoreTemplate = (template, messageContent, prevState, now) => {
  const content = String(messageContent || "")
  const signals = stageSignals[template.name] || []
  let weightedStageScore = 0

  template.stages.forEach((_, index) => {
    const match = signals[index] ? signals[index].test(content) : false
    if (match) weightedStageScore += template.transitionWeights[index] || 0
  })

  const lastUpdate = prevState?.lastUpdated || 0
  const decayed = now - lastUpdate > template.timeWindow ? (prevState?.score || 0) * template.decayFactor : (prevState?.score || 0)
  const combined = weightedStageScore + decayed

  return clamp01(sigmoid((combined - 0.35) * 4))
}

const scoreIntent = ({ templates, messageContent, derivativeVector = [], knownProfiles = [] }) => {
  const now = Date.now()
  const byType = {}

  for (const template of templates) {
    const previous = byType[template.name]
    const confidence = scoreTemplate(template, messageContent, previous, now)
    const similarity = knownProfiles.length
      ? Math.max(...knownProfiles.map(profile => cosineSimilarity(derivativeVector, profile)))
      : cosineSimilarity(derivativeVector, template.derivativeProfile || [])

    byType[template.name] = {
      confidence: clamp01((confidence * 0.75) + (Math.max(0, similarity) * 0.25)),
      lastUpdated: now,
      score: confidence
    }
  }

  return byType
}

module.exports = {
  scoreIntent
}
