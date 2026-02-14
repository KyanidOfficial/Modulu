require("dotenv").config()

const client = require("./bootstrap/client")
const logger = require("./bootstrap/logger")
const bootstrap = require("./bootstrap")
const decayJob = require("./jobs/reputation/decay.job")
const rewardJob = require("./jobs/reputation/reward.job")

const safeInterval = (job, interval, event) => {
  setInterval(async () => {
    try {
      await job()
    } catch (error) {
      logger.error(event, { message: error.message, stack: error.stack })
    }
  }, interval)
}

process.on("unhandledRejection", error => {
  logger.error("process.unhandledRejection", { message: error?.message, stack: error?.stack })
})

process.on("uncaughtException", error => {
  logger.error("process.uncaughtException", { message: error?.message, stack: error?.stack })
})

client.on("error", error => {
  logger.error("client.error", { message: error?.message, stack: error?.stack })
})

client.on("shardError", error => {
  logger.error("client.shardError", { message: error?.message, stack: error?.stack })
})

bootstrap(client)

client.login(process.env.TOKEN).catch(error => {
  logger.error("client.login", { message: error?.message, stack: error?.stack })
})

safeInterval(decayJob, Number(process.env.REPUTATION_DECAY_INTERVAL_MS || 3600000), "job.reputation.decay")
safeInterval(rewardJob, Number(process.env.CLEAN_REWARD_INTERVAL_MS || 3600000), "job.reputation.reward")
