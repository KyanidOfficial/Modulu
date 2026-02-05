'use strict'

const { guardCommand } = require('../../../utils/commandGuard')
const { isCommandEnabled } = require('../../../utils/commandToggle')

const COMMAND_ENABLED = true

module.exports = {
  name: 'help',
  description: 'help command',
  data: { name: 'help', description: 'help command' },
  COMMAND_ENABLED,
  execute: async interaction => {
    const guard = await guardCommand({
      commandName: 'help',
      interaction,
      requiredDiscordPerms: [],
      requireGuild: true,
      requireTarget: false,
      durationMs: null,
      reason: null,
      target: null,
      commandEnabled: COMMAND_ENABLED
    })
    if (!guard.allowed) return { error: guard.error }

    const list = Array.isArray(interaction && interaction.commands)
      ? interaction.commands.filter(isCommandEnabled).map(cmd => cmd.name)
      : []

    return { ok: true, commands: list, reason: guard.reason }
  }
}
