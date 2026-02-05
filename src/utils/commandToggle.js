'use strict'

const { disabled } = require('../config/commandToggle')

const isCommandEnabled = command => {
  if (!command) return false
  if (command.COMMAND_ENABLED === false) return false
  if (command.name && disabled.has(command.name)) return false
  return true
}

const requireEnabled = command => {
  if (isCommandEnabled(command)) return { ok: true }
  const name = command && command.name ? command.name : 'unknown'
  return {
    ok: false,
    reason: `Command "${name}" is disabled by developers.`
  }
}

module.exports = { isCommandEnabled, requireEnabled }
