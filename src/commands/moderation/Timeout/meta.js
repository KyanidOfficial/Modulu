'use strict'

const { guardCommand } = require('../../../utils/commandGuard.js')

const COMMAND_ENABLED = true

module.exports = {
  name: 'timeout-meta',
  description: 'timeout-meta command',
  data: { name: 'timeout-meta', description: 'timeout-meta command' },
  COMMAND_ENABLED,
  execute: async interaction => {
    const guild = interaction && interaction.guild
    const target = interaction && interaction.options && interaction.options.getMember ? interaction.options.getMember('user') : null
    const durationMs = interaction && interaction.options && interaction.options.getInteger ? interaction.options.getInteger('duration_ms') : null
    const reason = interaction && interaction.options && interaction.options.getString ? interaction.options.getString('reason') : null

    const guard = await guardCommand({
      commandName: 'timeout',
      interaction,
      requiredDiscordPerms: ['ModerateMembers'],
      requireGuild: true,
      requireTarget: true,
      durationMs,
      reason,
      target,
      commandEnabled: COMMAND_ENABLED
    })
    if (!guard.allowed) return { error: guard.error }

    return { ok: true, reason: guard.reason }
  }
}
