const fs = require("fs")
const path = require("path")
const registry = require("../registry/slash.commands")
const { isCommandEnabled } = require("../../utils/commandToggle")

const findSlashFiles = dir => {
  const files = []

  for (const entry of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, entry)
    const stat = fs.statSync(fullPath)

    if (stat.isDirectory()) {
      files.push(...findSlashFiles(fullPath))
      continue
    }

    if (entry !== "slash.js") continue
    files.push(fullPath)
  }

  return files
}

module.exports = client => {
  console.log("Slash loader started")

  const base = path.join(__dirname, "..", "..", "commands")
  if (!fs.existsSync(base)) return

  const slashFiles = findSlashFiles(base)
  const names = new Set()

  for (const slashPath of slashFiles) {
    try {
      const command = require(slashPath)
      if (!command?.data?.name || typeof command.execute !== "function") {
        continue
      }

      if (!isCommandEnabled(command)) {
        console.log("Skipped disabled command", command.data.name)
        continue
      }

      if (names.has(command.data.name) || client.commands.has(command.data.name)) {
        throw new Error(`Duplicate slash name ${command.data.name}`)
      }

      const metaPath = path.join(path.dirname(slashPath), "meta.js")
      command.meta = fs.existsSync(metaPath) ? require(metaPath) : {}

      names.add(command.data.name)
      registry.set(command.data.name, command)
      client.commands.set(command.data.name, command)
      console.log("Loaded slash command", command.data.name)
    } catch (error) {
      console.error("Failed to load command", slashPath)
      console.error(error)
      throw error
    }
  }

  console.log("Slash loader finished", client.commands.size)
}
