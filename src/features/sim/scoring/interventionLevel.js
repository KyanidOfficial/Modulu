const getInterventionLevel = report => Number(report?.level || 0)

module.exports = {
  getInterventionLevel
}
