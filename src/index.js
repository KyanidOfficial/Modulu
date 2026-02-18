require("dotenv").config()
require("./core/workers/violationCleanup")()
require("./core/workers/spamCleanup")()
const client = require("./client")
const bootstrap = require("./bootstrap")

;(async () => {
  try {
    await bootstrap(client)
    require("./core/loops/staffTime.loop")(client)
    await client.login(process.env.TOKEN)
  } catch (error) {
    console.error("[BOOT] Failed to start Modulus", error)
    process.exitCode = 1
  }
})()
