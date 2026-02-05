'use strict'

const { guardCommand } = require('../../../../utils/commandGuard.js')

const COMMAND_ENABLED = true

module.exports = {
  name: 'setup-builders-harmfulLinks.rows',
  description: 'setup-builders-harmfulLinks.rows command',
  data: { name: 'setup-builders-harmfulLinks.rows', description: 'setup-builders-harmfulLinks.rows command' },
  COMMAND_ENABLED,
  execute: async interaction => {
    const guild = interaction && interaction.guild
    const target = interaction && interaction.options && interaction.options.getMember ? interaction.options.getMember('user') : null
    const durationMs = null
    const reason = interaction && interaction.options && interaction.options.getString ? interaction.options.getString('reason') : null

    const guard = await guardCommand({
      commandName: 'setup',
      interaction,
      requiredDiscordPerms: [],
      requireGuild: true,
      requireTarget: false,
      durationMs,
      reason,
      target,
      commandEnabled: COMMAND_ENABLED
    })
    if (!guard.allowed) return { error: guard.error }

    return { ok: true, reason: guard.reason }
  }
}
