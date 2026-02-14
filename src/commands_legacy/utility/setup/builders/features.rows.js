const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js")

const buildFeaturesRows = session => {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("toggle_dm").setLabel(`DM on punish: ${session.features.dmOnPunish ? "On" : "Off"}`).setStyle(session.features.dmOnPunish ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("toggle_server_logs").setLabel(`Server logs: ${session.features.serverLogs ? "On" : "Off"}`).setStyle(session.features.serverLogs ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("toggle_chat_logs").setLabel(`Chat logs: ${session.features.chatLogs ? "On" : "Off"}`).setStyle(session.features.chatLogs ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("toggle_joingate").setLabel(`Join Gate: ${session.joinGate.enabled ? "On" : "Off"}`).setStyle(session.joinGate.enabled ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("toggle_harmful_links").setLabel(`Harmful links: ${session.features.harmfulLinks ? "On" : "Off"}`).setStyle(session.features.harmfulLinks ? ButtonStyle.Success : ButtonStyle.Secondary)
  )

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("setup_joingate_config").setLabel("Join Gate Settings").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("setup_harmful_links_config").setLabel("Harmful Links Settings").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("setup_features_back").setLabel("Back").setStyle(ButtonStyle.Secondary)
  )

  return [row1, row2]
}

module.exports = { buildFeaturesRows }