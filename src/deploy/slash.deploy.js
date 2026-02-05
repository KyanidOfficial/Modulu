'use strict'

const path = require('path')
const { loadSlashCommands } = require('../core/loaders/slash.loader')

const baseDir = path.join(__dirname, '..', 'commands')

try {
  const commands = loadSlashCommands(baseDir)
  console.log('Loaded commands:', commands.length)
} catch (err) {
  console.error('Deploy failed:', err.message)
  process.exitCode = 1
}
