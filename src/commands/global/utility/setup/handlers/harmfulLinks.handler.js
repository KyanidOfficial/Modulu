const harmfulRows = require("../builders/harmfulLinks.rows")
const previewEmbed = require("../../../../../messages/embeds/setup.preview.embed")

exports.toggleHarmfulLinks = async (i, interaction, session, store) => {
  session.features.harmfulLinks = !session.features.harmfulLinks
  session.harmfulLinks.enabled = session.features.harmfulLinks
  store.set(interaction.guild.id, session)
  const [r1, r2] = require("../builders/features.rows").buildFeaturesRows(session)
  return i.update({ embeds: [previewEmbed(session)], components: [r1, r2] })
}

exports.openHarmfulLinksConfig = async (i, interaction, session, store) => {
  session.view = "harmfulLinks"
  store.set(interaction.guild.id, session)
  return i.update({ embeds: [previewEmbed(session)], components: harmfulRows.buildHarmfulLinksRows(session) })
}

exports.toggleScanStaff = async (i, interaction, session, store) => {
  session.harmfulLinks.scanStaff = !session.harmfulLinks.scanStaff
  store.set(interaction.guild.id, session)
  return i.update({ embeds: [previewEmbed(session)], components: harmfulRows.buildHarmfulLinksRows(session) })
}

exports.toggleTimeout = async (i, interaction, session, store) => {
  session.harmfulLinks.timeout = session.harmfulLinks.timeout || { enabled: false, duration: 10 * 60 * 1000 }
  session.harmfulLinks.timeout.enabled = !session.harmfulLinks.timeout.enabled
  store.set(interaction.guild.id, session)
  return i.update({ embeds: [previewEmbed(session)], components: harmfulRows.buildHarmfulLinksRows(session) })
}

exports.timeoutPlus = async (i, interaction, session, store) => {
  session.harmfulLinks.timeout = session.harmfulLinks.timeout || { enabled: false, duration: 10 * 60 * 1000 }
  session.harmfulLinks.timeout.duration += 60 * 1000
  store.set(interaction.guild.id, session)
  return i.update({ embeds: [previewEmbed(session)], components: harmfulRows.buildHarmfulLinksRows(session) })
}

exports.timeoutMinus = async (i, interaction, session, store) => {
  session.harmfulLinks.timeout = session.harmfulLinks.timeout || { enabled: false, duration: 10 * 60 * 1000 }
  session.harmfulLinks.timeout.duration = Math.max(60 * 1000, session.harmfulLinks.timeout.duration - 60 * 1000)
  store.set(interaction.guild.id, session)
  return i.update({ embeds: [previewEmbed(session)], components: harmfulRows.buildHarmfulLinksRows(session) })
}

exports.backToFeatures = async (i, interaction, session, store) => {
  session.view = "features"
  store.set(interaction.guild.id, session)
  const [r1, r2] = require("../builders/features.rows").buildFeaturesRows(session)
  return i.update({ embeds: [previewEmbed(session)], components: [r1, r2] })
}