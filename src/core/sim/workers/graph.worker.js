const { parentPort } = require("worker_threads")

const average = values => (values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0)

parentPort.on("message", payload => {
  const { edges, joinedAtMap, threshold } = payload

  const timingScores = edges.temporalCorrelation.map(item => item.value)
  const lexicalScores = edges.lexicalSimilarity.map(item => item.value)
  const joinTimes = Object.values(joinedAtMap || {})
  const joinSpread = joinTimes.length > 1 ? (Math.max(...joinTimes) - Math.min(...joinTimes)) : 0
  const joinProximity = joinSpread <= (1000 * 60 * 60 * 4) ? 1 : 0.2
  const roleAnomaly = edges.roleAcquisitionAnomalies?.length ? average(edges.roleAcquisitionAnomalies.map(i => i.value)) : 0

  const clusterCoefficient = average([
    average(timingScores),
    average(lexicalScores),
    joinProximity,
    roleAnomaly
  ])

  parentPort.postMessage({
    clusterCoefficient,
    isCluster: clusterCoefficient >= threshold
  })
})
