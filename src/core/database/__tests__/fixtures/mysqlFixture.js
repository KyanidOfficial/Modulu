const makeConnection = ({ delayMs = 0, shouldTimeout = false }) => ({
  async execute(sql, params) {
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }

    if (shouldTimeout) {
      const error = new Error("connect ETIMEDOUT")
      error.code = "ETIMEDOUT"
      throw error
    }

    return [[{ sql, params }], { affectedRows: 1 }]
  },
  release() {}
})

const makePoolFixture = ({ delayMs = 0, shouldTimeout = false } = {}) => ({
  async getConnection() {
    return makeConnection({ delayMs, shouldTimeout })
  }
})

module.exports = {
  makePoolFixture
}
