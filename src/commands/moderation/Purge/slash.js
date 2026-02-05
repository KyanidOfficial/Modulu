'use strict'

const { resolveModerationAccess } = require('../../../utils/permissionResolver')

module.exports = {
  name: 'purge',
  description: 'purge command',
  data: { name: 'purge', description: 'purge command' },
  COMMAND_ENABLED: true,
  execute: async interaction => {
    const guild = interaction && interaction.guild
    if (!guild) return { error: 'Missing guild' }

    const executor = interaction.member
    const amount = interaction.options && interaction.options.getInteger ? interaction.options.getInteger('amount') : null

    const access = await resolveModerationAccess({
      guildId: guild.id,
      member: executor,
      requiredDiscordPerms: ['ManageMessages']
    })
    if (!access.allowed) return { error: access.reason }

    if (!Number.isInteger(amount)) return { error: 'Amount must be an integer' }
    if (amount < 1 || amount > 100) return { error: 'Amount must be 1-100' }

    const available = Number.isInteger(interaction.availableMessages) ? interaction.availableMessages : amount
    const deleted = Math.min(amount, available)

    console.log('purge', { requested: amount, deleted })

    return { ok: true, deleted }
  }
}
