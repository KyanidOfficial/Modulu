const calculateRiskScore = report => Number(report?.globalRisk || 0)

module.exports = {
  calculateRiskScore
}
