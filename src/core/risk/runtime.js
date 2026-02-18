const fs = require("node:fs")
const path = require("node:path")
const { execSync } = require("node:child_process")
const { getPool } = require("../database/mysql")

const distEntryPath = path.resolve(__dirname, "../../../dist/risk/index.js")

let autoBuildAttempted = false
let cachedModule = null
let status = {
  distPath: distEntryPath,
  distExists: false,
  exportKeys: [],
  mysqlConnection: "UNKNOWN",
  engineInitialized: "FAILED",
  errorCode: null
}

const logStartupDiagnostics = () => {
  console.log(`[RISK] Dist path resolved: ${status.distPath}`)
  console.log(`[RISK] Dist exists: ${status.distExists}`)
  console.log(`[RISK] Export keys: ${JSON.stringify(status.exportKeys)}`)
  console.log(`[RISK] MySQL connection: ${status.mysqlConnection}`)
  console.log(`[RISK] Engine initialized: ${status.engineInitialized}`)
}

const tryAutoBuild = () => {
  if (autoBuildAttempted) return
  autoBuildAttempted = true

  console.log("[RISK] Dist missing; attempting automatic build via `npm run build:risk`...")
  try {
    execSync("npm run build:risk", {
      cwd: path.resolve(__dirname, "../../.."),
      stdio: "inherit",
      env: process.env
    })
    console.log("[RISK] Automatic risk build completed.")
  } catch (error) {
    status.errorCode = "AUTO_BUILD_FAILED"
    console.error("[RISK] Automatic risk build failed.")
    console.error(error?.message || error)
  }
}

const loadCompiledRiskModule = () => {
  status.distExists = fs.existsSync(distEntryPath)
  if (!status.distExists) {
    tryAutoBuild()
    status.distExists = fs.existsSync(distEntryPath)
  }

  if (!status.distExists) {
    status.errorCode = status.errorCode || "DIST_MISSING_AFTER_BUILD"
    console.error(`[RISK] Compiled risk entry missing at: ${distEntryPath}`)
    return null
  }

  try {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const mod = require(distEntryPath)
    status.exportKeys = Object.keys(mod || {})

    const hasRepo = typeof mod?.MySqlRiskRepository === "function"
    const hasEngine = typeof mod?.RiskEngine === "function"

    if (!hasRepo || !hasEngine) {
      status.errorCode = "INVALID_EXPORTS"
      console.error("[RISK] Invalid risk export structure. Expected MySqlRiskRepository and RiskEngine.")
      console.error("[RISK] Actual exports:", status.exportKeys)
      return null
    }

    return mod
  } catch (error) {
    status.errorCode = "REQUIRE_FAILED"
    console.error(`[RISK] Failed requiring compiled risk module at ${distEntryPath}`)
    console.error(error)
    return null
  }
}

const validateMysqlConnection = async pool => {
  if (!pool || typeof pool.query !== "function") {
    status.mysqlConnection = "FAILED"
    status.errorCode = status.errorCode || "POOL_INVALID"
    console.error("[RISK] MySQL pool is unavailable or invalid.")
    return false
  }

  try {
    await pool.query("SELECT 1 AS ok")
    status.mysqlConnection = "OK"
    return true
  } catch (error) {
    status.mysqlConnection = "FAILED"
    status.errorCode = status.errorCode || "MYSQL_CONNECTIVITY_FAILED"
    console.error("[RISK] MySQL connectivity test failed (SELECT 1).")
    console.error(error?.message || error)
    return false
  }
}

const initRiskEngine = async () => {
  status = {
    distPath: distEntryPath,
    distExists: false,
    exportKeys: [],
    mysqlConnection: "UNKNOWN",
    engineInitialized: "FAILED",
    errorCode: null
  }

  const mod = loadCompiledRiskModule()
  if (!mod) {
    logStartupDiagnostics()
    return null
  }

  const pool = getPool()
  const mysqlReady = await validateMysqlConnection(pool)
  if (!mysqlReady) {
    logStartupDiagnostics()
    return null
  }

  try {
    const repository = new mod.MySqlRiskRepository(pool)
    cachedModule = mod
    status.engineInitialized = "OK"
    const engine = new mod.RiskEngine(repository)
    logStartupDiagnostics()
    return engine
  } catch (error) {
    status.errorCode = status.errorCode || "ENGINE_CONSTRUCT_FAILED"
    status.engineInitialized = "FAILED"
    console.error("[RISK] Failed to initialize RiskEngine instance.")
    console.error(error)
    logStartupDiagnostics()
    return null
  }
}

const getRiskRuntimeStatus = () => ({ ...status, hasModule: Boolean(cachedModule) })

module.exports = {
  initRiskEngine,
  getRiskRuntimeStatus
}
