const detectGrooming = report => Number(report?.state?.dimensions?.groomingProbability || 0)

module.exports = {
  detectGrooming
}
