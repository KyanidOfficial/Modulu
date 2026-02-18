const path = require("path")
const { getPool } = require("../database/mysql")

const loadCompiledRisk = () => {
  try {
    const compiledPath = path.join(__dirname, "../../../dist/index.js")
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const mod = require(compiledPath)

    if (!mod) {
      console.warn("[RISK] Risk module loaded but is empty.")
      return null
    }

    return mod
  } catch (error) {
    console.warn("[RISK] Dist build missing or failed to load. Run `npm run build:risk`.")
    console.warn("[RISK] Load error:", error.message)
    return null
  }
}

const resolveExport = (mod, key) => {
  if (!mod) return null

  if (mod[key]) return mod[key]

  if (mod.default && mod.default[key]) return mod.default[key]

  if (mod.default && key === "RiskEngine" && typeof mod.default === "function") {
    return mod.default
  }

  return null
}

const initRiskEngine = () => {
  const mod = loadCompiledRisk()
  if (!mod) return null

  const MySqlRiskRepository = resolveExport(mod, "MySqlRiskRepository")
  const RiskEngine = resolveExport(mod, "RiskEngine")

  if (!MySqlRiskRepository) {
    console.error("[RISK] MySqlRiskRepository export not found.")
    return null
  }

  if (!RiskEngine) {
    console.error("[RISK] RiskEngine export not found.")
    return null
  }

  const pool = getPool()

  if (!pool) {
    console.error("[RISK] MySQL pool not available.")
    return null
  }

  try {
    const repository = new MySqlRiskRepository(pool)
    const engine = new RiskEngine(repository)

    console.log("[RISK] RiskEngine initialized successfully.")
    return engine
  } catch (error) {
    console.error("[RISK] Failed to initialize RiskEngine:", error.message)
    return null
  }
}

module.exports = {
  initRiskEngine
}