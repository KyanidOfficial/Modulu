const fs = require("fs")
const path = require("path")
const registry = require("../registry/prefix.commands")

module.exports = client => {
  const base = path.join(__dirname, "..", "..", "commands")
  if (process.env.PREFIX_DISABLED === "true") return
  
  for (const category of fs.readdirSync(base)) {
    const catPath = path.join(base, category)
    if (!fs.statSync(catPath).isDirectory()) continue

    for (const cmd of fs.readdirSync(catPath)) {
      const cmdPath = path.join(catPath, cmd)
      if (!fs.statSync(cmdPath).isDirectory()) continue

      const prefix = path.join(cmdPath, "prefix.js")
      if (!fs.existsSync(prefix)) continue

      const metaPath = path.join(cmdPath, "meta.js")
      const command = require(prefix)
      command.meta = fs.existsSync(metaPath) ? require(metaPath) : {}

      registry.set(command.name, command)
      client.prefixCommands.set(command.name, command)
    }
  }
}