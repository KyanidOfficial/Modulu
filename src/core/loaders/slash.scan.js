const fs = require("fs")
const path = require("path")

const readDirSorted = dir =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))

const collectSlashCommandFiles = baseDir => {
  const root = path.resolve(baseDir)
  const slashFiles = []
  const seenFiles = new Set()

  const walk = dir => {
    const entries = readDirSorted(dir)
    const slashEntries = entries.filter(entry => entry.isFile() && entry.name === "slash.js")

    if (slashEntries.length > 1) {
      throw new Error(`Multiple slash.js files in command folder: ${path.resolve(dir)}`)
    }

    for (const entry of entries) {
      const fullPath = path.resolve(dir, entry.name)
      if (entry.isDirectory()) {
        walk(fullPath)
        continue
      }

      if (!entry.isFile()) continue
      if (entry.name !== "slash.js") continue

      if (seenFiles.has(fullPath)) {
        throw new Error(`Duplicate slash.js file load detected: ${fullPath}`)
      }

      seenFiles.add(fullPath)
      slashFiles.push(fullPath)
    }
  }

  walk(root)
  return slashFiles
}

module.exports = {
  collectSlashCommandFiles
}
