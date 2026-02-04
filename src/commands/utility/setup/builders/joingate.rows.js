const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js")

const buildJoinGateRows = session => {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("setup_joingate_age_minus").setLabel("-").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("setup_joingate_age_info").setLabel(`Account age days: ${session.joinGate.accountAgeDays}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
    new ButtonBuilder().setCustomId("setup_joingate_age_plus").setLabel("+").setStyle(ButtonStyle.Secondary)
  )

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("setup_joingate_requireAvatar").setLabel(`Require Avatar: ${session.joinGate.requireAvatar ? "On" : "Off"}`).setStyle(session.joinGate.requireAvatar ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("setup_joingate_back").setLabel("Back").setStyle(ButtonStyle.Secondary)
  )

  return [row1, row2]
}

module.exports = { buildJoinGateRows }