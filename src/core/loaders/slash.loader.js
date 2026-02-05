'use strict'

const fs = require('fs')
const path = require('path')
const { isCommandEnabled, requireEnabled } = require('../../utils/commandToggle')

const loadSlashCommands = baseDir => {
  const commands = []
  const names = new Set()
  const base = baseDir || path.join(__dirname, '..', '..', 'commands')
  if (!fs.existsSync(base)) return commands

  for (const category of fs.readdirSync(base)) {
    const categoryPath = path.join(base, category)
    if (!fs.statSync(categoryPath).isDirectory()) continue

    for (const folder of fs.readdirSync(categoryPath)) {
      const folderPath = path.join(categoryPath, folder)
      if (!fs.statSync(folderPath).isDirectory()) continue

      const slashPath = path.join(folderPath, 'slash.js')
      if (!fs.existsSync(slashPath)) continue

      let command
      try {
        command = require(slashPath)
      } catch (err) {
        throw new Error(`Failed to load ${slashPath}: ${err.message}`)
      }

      const enabled = requireEnabled(command)
      if (!enabled.ok) {
        continue
      }

      if (!command || !command.name || !command.data || !command.execute) {
        throw new Error(`Invalid command schema for ${slashPath}`)
      }

      if (names.has(command.name)) {
        throw new Error(`Duplicate command name ${command.name}`)
      }

      if (!isCommandEnabled(command)) {
        continue
      }

      names.add(command.name)
      commands.push(command)
    }
  }

  return commands
}

module.exports = { loadSlashCommands }
