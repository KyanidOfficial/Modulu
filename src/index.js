require("dotenv").config()

const { handleClientError } = require("./core/observability/errorHandler")

const bindProcessGuards = () => {
  process.on("unhandledRejection", error => {
    handleClientError({ error, event: "unhandledRejection" })
  })

  process.on("uncaughtException", error => {
    handleClientError({ error, event: "uncaughtException" })
  })
}

const bindClientGuards = client => {
  client.on("error", error => {
    handleClientError({ error, event: "client.error" })
  })

  client.on("shardError", error => {
    handleClientError({ error, event: "client.shardError" })
  })
}

const safeInterval = (fn, intervalMs, eventName) => {
  setInterval(async () => {
    try {
      await fn()
    } catch (error) {
      handleClientError({ error, event: eventName })
    }
  }, intervalMs)
}

require("./core/workers/violationCleanup")()
require("./core/workers/spamCleanup")()

const client = require("./client")
const reputationDecayJob = require("./jobs/reputationDecay")
const cleanRewardJob = require("./jobs/cleanReward")

bindProcessGuards()
bindClientGuards(client)

require("./bootstrap")(client)
require("./core/loops/staffTime.loop")(client)

client.login(process.env.TOKEN).catch(error => {
  handleClientError({ error, event: "client.login" })
})

safeInterval(
  () => reputationDecayJob(),
  Number(process.env.REPUTATION_DECAY_INTERVAL_MS || 3600000),
  "jobs.reputationDecay"
)

safeInterval(
  () => cleanRewardJob(),
  Number(process.env.CLEAN_REWARD_INTERVAL_MS || 3600000),
  "jobs.cleanReward"
)
