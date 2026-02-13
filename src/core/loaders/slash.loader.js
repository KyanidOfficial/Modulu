const fs = require("fs")
const path = require("path")
const registry = require("../registry/slash.commands")
const { isCommandEnabled } = require("../../utils/commandToggle")

const findSlashCommandFiles = (dir, base) => {
  const files = []
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry)
    const stat = fs.statSync(full)

    if (stat.isDirectory()) {
      files.push(...findSlashCommandFiles(full, base))
      continue
    }

    if (!entry.endsWith(".js")) continue
    if (entry === "meta.js" || entry === "prefix.js") continue

    const relativeDir = path.relative(base, path.dirname(full))
    const depth = relativeDir.split(path.sep).filter(Boolean).length
    const isLegacySlashFile = entry === "slash.js"
    const isCategoryRootCommand = depth === 1

    if (!isLegacySlashFile && !isCategoryRootCommand) continue

    files.push(full)
  }
  return files
}

module.exports = client => {
  console.log("Slash loader started")

  const base = path.join(__dirname, "..", "..", "commands")
  if (!fs.existsSync(base)) return

  const commandFiles = findSlashCommandFiles(base, base)

  for (const commandPath of commandFiles) {
    try {
      const command = require(commandPath)

      if (!command) continue
      if (!command.data || !command.data.name) continue
      if (typeof command.execute !== "function") continue

      if (!isCommandEnabled(command)) {
        console.log("Skipped disabled command", command.data.name)
        continue
      }

      if (client.commands.has(command.data.name)) {
        console.error("Duplicate command name", command.data.name)
        continue
      }

      const metaPath = path.join(path.dirname(commandPath), "meta.js")
      command.meta = fs.existsSync(metaPath) ? require(metaPath) : {}

      registry.set(command.data.name, command)
      client.commands.set(command.data.name, command)

      console.log("Loaded slash command", command.data.name)
    } catch (err) {
      console.error("Failed to load command", commandPath)
      console.error(err)
    }
  }


  console.log("Slash loader finished", client.commands.size)
}
