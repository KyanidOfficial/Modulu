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

const executeQuery = async (sql, params = []) => {
  const result = await withConnection(async connection => connection.execute(sql, params))
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
