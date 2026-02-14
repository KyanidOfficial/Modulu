const db = require("../core/database")
const { report } = require("../core/observability/errorHandler")

module.exports = async ({ batchSize = 100, decayPoints = 1 } = {}) => {
  let cursor = 0
  while (true) {
    try {
      const { rows, nextCursor } = await db.processReputationDecay(cursor, batchSize, decayPoints)
      if (!rows.length || !nextCursor) break
      cursor = nextCursor
    } catch (error) {
      await report({ error, context: { job: "reputationDecay", cursor } })
      break
    }
  }
}
