const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js")
const previewEmbed = require("../../../../../messages/embeds/setup.preview.embed")
const completedEmbed = require("../../../../../messages/embeds/setup.completed.embed")

exports.preview = async (i, interaction, session, store) => {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("setup_confirm").setLabel("Confirm").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("setup_cancel").setLabel("Cancel").setStyle(ButtonStyle.Danger)
  )

  session.view = "confirm"
  store.set(interaction.guild.id, session)
  return i.update({ embeds: [previewEmbed(session)], components: [row] })
}

exports.confirm = async (i, interaction, session, store, collector, helpers) => {
  const { db, joinGateDb, harmfulLinksDb } = helpers
  const dataRow = (await db.get(interaction.guild.id)) || {}

  dataRow.setup = {
    completed: true,
    roles: session.roles,
    channels: session.channels,
    features: session.features
  }
  await db.save(interaction.guild.id, dataRow)

  await joinGateDb.save(interaction.guild.id, {
    enabled: !!session.joinGate.enabled,
    account_age_days: Number(session.joinGate.accountAgeDays || 7),
    require_avatar: !!session.joinGate.requireAvatar,
    category_id: null
  })

  const hl = session.harmfulLinks || {}

  await harmfulLinksDb.save(interaction.guild.id, {
    enabled: hl.enabled === true,
    scan_staff: hl.scanStaff === true,
    timeout: hl.timeout?.enabled === true,
    timeout_time: Number.isFinite(hl.timeout?.duration) ? Math.floor(hl.timeout.duration / 1000) : 600,
    log_enabled: hl.log !== false
  })

  store.clear(interaction.guild.id)
  collector.stop()

  return i.update({ embeds: [completedEmbed("Setup saved successfully.")], components: [] })
}

exports.cancel = async (i, interaction, session, store, collector) => {
  store.clear(interaction.guild.id)
  collector.stop()
  return i.update({ embeds: [require("../../../../../messages/embeds/setup.cancelled.embed")()], components: [] })
}