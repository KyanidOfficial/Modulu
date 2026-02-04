const fs = require("fs")
const path = require("path")
const registry = require("../registry/slash.commands")

module.exports = client => {
  console.log("Slash loader started")

  const base = path.join(__dirname, "..", "..", "commands")
  if (!fs.existsSync(base)) return

  for (const category of fs.readdirSync(base)) {
    const catPath = path.join(base, category)
    if (!fs.statSync(catPath).isDirectory()) continue

    for (const folder of fs.readdirSync(catPath)) {
      const cmdPath = path.join(catPath, folder)
      if (!fs.statSync(cmdPath).isDirectory()) continue

      const slashPath = path.join(cmdPath, "slash.js")
      if (!fs.existsSync(slashPath)) continue

      try {
        const command = require(slashPath)

        if (!command) continue
        if (!command.data || !command.data.name) {
          console.error("Missing command data", slashPath)
          continue
        }

        if (typeof command.execute !== "function") {
          console.error("Missing execute()", command.data.name)
          continue
        }

        if (client.commands.has(command.data.name)) {
          console.error("Duplicate command name", command.data.name)
          continue
        }

        const metaPath = path.join(cmdPath, "meta.js")
        command.meta = fs.existsSync(metaPath) ? require(metaPath) : {}

        registry.set(command.data.name, command)
        client.commands.set(command.data.name, command)

        console.log("Loaded slash command", command.data.name)
      } catch (err) {
        console.error("Failed to load command", slashPath)
        console.error(err)
      }
    }
  }

  console.log("Slash loader finished", client.commands.size)
}