const featuresRows = require("../builders/features.rows")
const previewEmbed = require("../../../../../messages/embeds/setup.preview.embed")

exports.openFeatures = async (i, interaction, session, store) => {
  session.view = "features"
  store.set(interaction.guild.id, session)
  const [fRow1, fRow2] = featuresRows.buildFeaturesRows(session)
  return i.update({ embeds: [previewEmbed(session)], components: [fRow1, fRow2] })
}

exports.backToMain = async (i, interaction, session, store) => {
  session.view = "main"
  store.set(interaction.guild.id, session)
  return i.update({
    embeds: [require("../../../../../messages/embeds/setup.start.embed")(interaction.guild)],
    components: [require("../builders/main.rows").buildMainRow()]
  })
}

exports.toggleDM = async (i, interaction, session, store) => {
  session.features.dmOnPunish = !session.features.dmOnPunish
  store.set(interaction.guild.id, session)
  const [fRow1, fRow2] = featuresRows.buildFeaturesRows(session)
  return i.update({ embeds: [previewEmbed(session)], components: [fRow1, fRow2] })
}

exports.toggleServerLogs = async (i, interaction, session, store) => {
  session.features.serverLogs = !session.features.serverLogs
  store.set(interaction.guild.id, session)
  const [fRow1, fRow2] = featuresRows.buildFeaturesRows(session)
  return i.update({ embeds: [previewEmbed(session)], components: [fRow1, fRow2] })
}

exports.toggleChatLogs = async (i, interaction, session, store) => {
  session.features.chatLogs = !session.features.chatLogs
  store.set(interaction.guild.id, session)
  const [fRow1, fRow2] = featuresRows.buildFeaturesRows(session)
  return i.update({ embeds: [previewEmbed(session)], components: [fRow1, fRow2] })
}

exports.toggleJoinGate = async (i, interaction, session, store) => {
  session.joinGate.enabled = !session.joinGate.enabled
  session.features.joinGate = session.joinGate.enabled
  store.set(interaction.guild.id, session)
  const [fRow1, fRow2] = featuresRows.buildFeaturesRows(session)
  return i.update({ embeds: [previewEmbed(session)], components: [fRow1, fRow2] })
}

exports.openJoinGateConfig = async (i, interaction, session, store) => {
  session.view = "joingate"
  store.set(interaction.guild.id, session)
  const [jRow1, jRow2] = require("../builders/joingate.rows").buildJoinGateRows(session)
  return i.update({ embeds: [previewEmbed(session)], components: [jRow1, jRow2] })
}