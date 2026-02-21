const { deployGlobalCommands } = require("./deployGlobalCommands")

;(async () => {
  try {
    await deployGlobalCommands()
  } catch (err) {
    console.error("Deploy failed")
    console.error(err)
    process.exit(1)
  }
})()
