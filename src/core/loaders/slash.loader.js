const fs = require("fs")
const path = require("path")
const logger = require("../../bootstrap/logger")

const readSorted = dir => fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))

const collect = root => {
  const files = []
  const walk = dir => {
    for (const entry of readSorted(dir)) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
      } else if (entry.isFile() && entry.name === "slash.js") {
        files.push(full)
      }
    }
  }
  walk(root)
  return files
}

module.exports = client => {
  const root = path.resolve(__dirname, "..", "..", "commands")
  const slashFiles = collect(root)
  const loaded = new Set()

  for (const slashPath of slashFiles) {
    const command = require(slashPath)
    const metaPath = path.join(path.dirname(slashPath), "meta.js")
    const meta = fs.existsSync(metaPath) ? require(metaPath) : {}

    const name = command?.data?.name
    if (!name) {
      logger.warn("slash.invalid", { slashPath })
      continue
    }

    if (loaded.has(name)) {
      const previous = client.commands.get(name)?.__file
      logger.error("slash.duplicate", { name, previous, conflict: slashPath })
      continue
    }

    loaded.add(name)
    command.meta = meta
    command.__file = slashPath
    client.commands.set(name, command)
  }

  logger.info("slash.loaded", { count: client.commands.size })
}
