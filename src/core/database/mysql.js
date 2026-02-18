const mysql = require("mysql2/promise")

/** @type {import('mysql2/promise').Pool | null} */
let sharedPool = null
let loggedReady = false

const getPoolConfig = () => ({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 3306),
  connectionLimit: 10,
  waitForConnections: true,
  queueLimit: 0,
  connectTimeout: 10000
})

const isTimeoutError = error => {
  if (!error) return false
  const code = String(error.code || "")
  const message = String(error.message || "")
  return code === "ETIMEDOUT" || code === "PROTOCOL_SEQUENCE_TIMEOUT" || message.includes("ETIMEDOUT")
}

const getPool = () => {
  if (sharedPool) return sharedPool

  const config = getPoolConfig()
  sharedPool = mysql.createPool(config)

  sharedPool
    .getConnection()
    .then(conn => {
      if (!loggedReady) {
        console.log(`[MYSQL] Pool connected ${config.host}:${config.port}/${config.database}`)
        loggedReady = true
      }
      conn.release()
    })
    .catch(error => {
      if (isTimeoutError(error)) {
        console.warn(`[MYSQL] Pool warm-up timeout (${error.code || "unknown"})`)
        return
      }
      console.error("[MYSQL] Pool warm-up failed", error)
    })

  return sharedPool
}

const withConnection = async operation => {
  const pool = getPool()
  let connection

  try {
    connection = await pool.getConnection()
    return await operation(connection)
  } catch (error) {
    if (isTimeoutError(error)) {
      console.warn("[MYSQL] Connection timeout while running query", error.message)
      return null
    }
    throw error
  } finally {
    if (connection) {
      connection.release()
    }
  }
}

const normalizeParams = params => {
  if (Array.isArray(params)) return params
  if (params === undefined || params === null) return []
  return [params]
}

const countPlaceholders = sql => {
  const stripped = String(sql || "").replace(/'[^']*'|"[^"]*"|`[^`]*`/g, "")
  return (stripped.match(/\?/g) || []).length
}

const executeQuery = async (sql, params = []) => {
  const boundParams = normalizeParams(params)
  const expectedParams = countPlaceholders(sql)

  if (expectedParams !== boundParams.length) {
    const error = new Error(`SQL placeholder mismatch: expected ${expectedParams}, received ${boundParams.length}`)
    error.code = "SQL_PLACEHOLDER_MISMATCH"
    error.sql = String(sql || "").trim().slice(0, 240)
    throw error
  }

  const result = await withConnection(async connection => connection.execute(sql, boundParams))
  if (!result) return [[], { affectedRows: 0 }]
  return result
}

const __setPoolForTests = pool => {
  sharedPool = pool
}

const __resetPoolForTests = () => {
  sharedPool = null
  loggedReady = false
}

module.exports = {
  getPool,
  withConnection,
  executeQuery,
  isTimeoutError,
  __setPoolForTests,
  __resetPoolForTests
}
