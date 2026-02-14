const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js")

const buildMainRow = () =>
  new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("setup_roles").setLabel("Roles").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("setup_channels").setLabel("Channels").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("setup_features").setLabel("Features").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("setup_preview").setLabel("Continue").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("setup_cancel").setLabel("Cancel").setStyle(ButtonStyle.Danger)
  )

const buildRolesRow = () =>
  new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("setup_roles_moderator").setLabel("Set Moderator Roles").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("setup_roles_admin").setLabel("Set Administrator Roles").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("setup_roles_back").setLabel("Back").setStyle(ButtonStyle.Secondary)
  )

const buildChannelsRow = () =>
  new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("setup_channels_mod").setLabel("Set Moderation Log").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("setup_channels_server").setLabel("Set Server Log").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("setup_channels_chat").setLabel("Set Chat Log").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("setup_channels_back").setLabel("Back").setStyle(ButtonStyle.Secondary)
  )

module.exports = { buildMainRow, buildRolesRow, buildChannelsRow }