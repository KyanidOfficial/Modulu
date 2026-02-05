'use strict'

const { guardCommand } = require('../../../utils/commandGuard.js')

const COMMAND_ENABLED = true

module.exports = {
  name: 'purge-meta',
  description: 'purge-meta command',
  data: { name: 'purge-meta', description: 'purge-meta command' },
  COMMAND_ENABLED,
  execute: async interaction => {
    const guild = interaction && interaction.guild
    const target = null
    const durationMs = null
    const reason = interaction && interaction.options && interaction.options.getString ? interaction.options.getString('reason') : null

    const guard = await guardCommand({
      commandName: 'purge',
      interaction,
      requiredDiscordPerms: ['ManageMessages'],
      requireGuild: true,
      requireTarget: false,
      durationMs,
      reason,
      target,
      commandEnabled: COMMAND_ENABLED
    })
    if (!guard.allowed) return { error: guard.error }

    const amount = interaction && interaction.options && interaction.options.getInteger ? interaction.options.getInteger('amount') : null
    if (!Number.isInteger(amount)) return { error: 'Amount must be an integer' }
    if (amount < 1 || amount > 100) return { error: 'Amount must be between 1 and 100' }
    const available = Number.isInteger(interaction && interaction.availableMessages) ? interaction.availableMessages : amount
    const deleted = Math.min(amount, available)
    const logsChannel = interaction && interaction.logsChannel ? interaction.logsChannel : null
    if (logsChannel && typeof logsChannel.send === 'function') {
      await logsChannel.send({ content: `Purged ${deleted} messages.` })
    }
    return { ok: true, deleted, reason: guard.reason }
  }
}
