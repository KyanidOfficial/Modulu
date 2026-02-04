const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js")

const buildHarmfulLinksRows = session => {
  const timeout = session.harmfulLinks?.timeout || { enabled: false, duration: 10 * 60 * 1000 }
  const minutes = Math.max(1, Math.round(timeout.duration / 60000))

  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("toggle_hl_scanstaff").setLabel(`Scan staff: ${session.harmfulLinks.scanStaff ? "On" : "Off"}`).setStyle(session.harmfulLinks.scanStaff ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("toggle_hl_timeout").setLabel(`Timeout: ${timeout.enabled ? "On" : "Off"}`).setStyle(timeout.enabled ? ButtonStyle.Success : ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("hl_time_minus").setLabel("-").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("hl_time_info").setLabel(`Timeout (min): ${minutes}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
      new ButtonBuilder().setCustomId("hl_time_plus").setLabel("+").setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("setup_hl_back").setLabel("Back").setStyle(ButtonStyle.Secondary)
    )
  ]
}

module.exports = { buildHarmfulLinksRows }