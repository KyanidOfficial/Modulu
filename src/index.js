require("dotenv").config()
require("./core/workers/violationCleanup")()

const { createContainer } = require("./app/container")
const { bootstrapApp } = require("./app/bootstrap")

;(async () => {
  try {
    const container = createContainer()
    const { client } = container

    await bootstrapApp(container)
    require("./core/loops/staffTime.loop")(client)
    await client.login(process.env.TOKEN)
  } catch (error) {
    console.error("[BOOT] Failed to start Modulus", error)
    process.exitCode = 1
  }
})()
