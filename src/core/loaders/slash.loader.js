const fs = require("fs")
const path = require("path")
const registry = require("../registry/slash.commands")
const { isCommandEnabled } = require("../../utils/commandToggle")
const { collectSlashCommandFiles } = require("./slash.scan")

const findSlashFiles = dir => {
  const files = []

  const base = path.resolve(__dirname, "..", "..", "commands")
  if (!fs.existsSync(base)) return

  const slashFiles = collectSlashCommandFiles(base)
  const commandNameToFile = new Map()

  for (const slashPath of slashFiles) {
    const command = require(slashPath)

    if (!command || !command.data || typeof command.data.name !== "string" || !command.data.name.trim()) {
      throw new Error(`Invalid slash export in ${slashPath}: expected data.name`)
    }

    if (typeof command.execute !== "function") {
      throw new Error(`Invalid slash export in ${slashPath}: expected execute()`)
    }

    if (!isCommandEnabled(command)) {
      console.log("Skipped disabled command", command.data.name)
      continue
    }

    if (commandNameToFile.has(command.data.name)) {
      const firstPath = commandNameToFile.get(command.data.name)
      throw new Error(
        `Duplicate slash name ${command.data.name}\nfirst: ${firstPath}\nsecond: ${slashPath}`
      )
    }

    const metaPath = path.resolve(path.dirname(slashPath), "meta.js")
    let meta = {}
    if (fs.existsSync(metaPath)) {
      meta = require(metaPath)
      if (meta && (Object.prototype.hasOwnProperty.call(meta, "data") || Object.prototype.hasOwnProperty.call(meta, "execute"))) {
        throw new Error(`Invalid meta export in ${metaPath}: meta.js must not export command handlers`)
      }
    }

    command.meta = meta
    commandNameToFile.set(command.data.name, slashPath)
    registry.set(command.data.name, command)
    client.commands.set(command.data.name, command)
    console.log("Loaded slash command", command.data.name, slashPath)
  }


  console.log("Slash loader finished", client.commands.size)
}
