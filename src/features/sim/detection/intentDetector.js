const detectIntent = report => ({
  grooming: Number(report?.state?.dimensions?.groomingProbability || 0),
  harassment: Number(report?.state?.dimensions?.harassmentEscalation || 0),
  spam: Number(report?.state?.dimensions?.spamAggression || 0)
})

module.exports = {
  detectIntent
}
