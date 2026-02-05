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
        console.error('Failed to load command', slashPath, err.message)
        throw err
      }

      const enabled = requireEnabled(command)
      if (!enabled.ok) {
        console.log('Skipped disabled command', slashPath, enabled.reason)
        continue
      }

      if (!command || !command.name || !command.data || !command.execute) {
        const err = new Error(`Invalid command schema: ${slashPath}`)
        console.error(err.message)
        throw err
      }

      if (names.has(command.name)) {
        const err = new Error(`Duplicate command name: ${command.name}`)
        console.error(err.message)
        throw err
      }

      if (!isCommandEnabled(command)) {
        console.log('Skipped disabled command', slashPath, 'COMMAND_ENABLED=false')
        continue
      }

      names.add(command.name)
      commands.push(command)
    }
  }

  return commands
}

module.exports = { loadSlashCommands }
