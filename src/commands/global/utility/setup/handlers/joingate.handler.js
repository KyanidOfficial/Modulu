const joingateRows = require("../builders/joingate.rows")
const previewEmbed = require("../../../../../messages/embeds/setup.preview.embed")

exports.increaseAge = async (i, interaction, session, store) => {
  session.joinGate.accountAgeDays = Math.min(365, (session.joinGate.accountAgeDays || 0) + 1)
  store.set(interaction.guild.id, session)
  const [jRow1, jRow2] = joingateRows.buildJoinGateRows(session)
  return i.update({ embeds: [previewEmbed(session)], components: [jRow1, jRow2] })
}

exports.decreaseAge = async (i, interaction, session, store) => {
  session.joinGate.accountAgeDays = Math.max(0, (session.joinGate.accountAgeDays || 0) - 1)
  store.set(interaction.guild.id, session)
  const [jRow1, jRow2] = joingateRows.buildJoinGateRows(session)
  return i.update({ embeds: [previewEmbed(session)], components: [jRow1, jRow2] })
}

exports.toggleRequireAvatar = async (i, interaction, session, store) => {
  session.joinGate.requireAvatar = !session.joinGate.requireAvatar
  store.set(interaction.guild.id, session)
  const [jRow1, jRow2] = joingateRows.buildJoinGateRows(session)
  return i.update({ embeds: [previewEmbed(session)], components: [jRow1, jRow2] })
}

exports.backToFeatures = async (i, interaction, session, store) => {
  session.view = "features"
  store.set(interaction.guild.id, session)
  const [fRow1, fRow2] = require("../builders/features.rows").buildFeaturesRows(session)
  return i.update({ embeds: [previewEmbed(session)], components: [fRow1, fRow2] })
}