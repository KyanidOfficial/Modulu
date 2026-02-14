const fs = require("fs")
const path = require("path")
const registry = require("../registry/prefix.commands")

const findPrefixCommandFiles = dir => {
  const files = []

  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry)
    const stat = fs.statSync(full)

    if (stat.isDirectory()) {
      files.push(...findPrefixCommandFiles(full))
      continue
    }

    if (entry !== "prefix.js") continue
    files.push(full)
  }

  return files
}

module.exports = client => {
  const base = path.join(__dirname, "..", "..", "commands")
  if (process.env.PREFIX_DISABLED === "true") return
  if (!fs.existsSync(base)) return

  const commandFiles = findPrefixCommandFiles(base)

  for (const commandPath of commandFiles) {
    const commandDir = path.dirname(commandPath)
    const metaPath = path.join(commandDir, "meta.js")
    const command = require(commandPath)
    command.meta = fs.existsSync(metaPath) ? require(metaPath) : {}

    registry.set(command.name, command)
    client.prefixCommands.set(command.name, command)
  }
}
