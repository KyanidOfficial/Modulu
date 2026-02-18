const path = require("path")
const { getPool } = require("../database/mysql")

const loadCompiledRisk = () => {
  try {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    return require(path.join(__dirname, "../../../dist/index.js"))
  } catch (error) {
    console.warn("[RISK] Dist build missing. Run `npm run build:risk` to enable RiskEngine.")
    return null
  }
}

const initRiskEngine = () => {
  const mod = loadCompiledRisk()
  if (!mod) return null

  const pool = getPool()
  const repository = new mod.MySqlRiskRepository(pool)
  const engine = new mod.RiskEngine(repository)

  console.log("[RISK] RiskEngine initialized")
  return engine
}

module.exports = {
  initRiskEngine
}
