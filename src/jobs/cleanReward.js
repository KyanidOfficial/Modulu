const db = require("../core/database")
const { report } = require("../core/observability/errorHandler")

module.exports = async ({ batchSize = 100, rewardPoints = 1 } = {}) => {
  let cursor = 0
  while (true) {
    try {
      const { rows, nextCursor } = await db.processCleanRewards(cursor, batchSize, rewardPoints)
      if (!rows.length || !nextCursor) break
      cursor = nextCursor
    } catch (error) {
      await report({ error, context: { job: "cleanReward", cursor } })
      break
    }
  }
}
