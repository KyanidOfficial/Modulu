const { ActionRowBuilder, ChannelSelectMenuBuilder } = require("discord.js")
const mainRows = require("../builders/main.rows")
const previewEmbed = require("../../../../../messages/embeds/setup.preview.embed")

exports.openChannels = async (i, interaction, session, store) => {
  session.view = "channels"
  store.set(interaction.guild.id, session)
  const row = mainRows.buildChannelsRow()
  return i.update({ embeds: [previewEmbed(session)], components: [row] })
}

exports.openModSelect = async (i) => {
  const row = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder().setCustomId("setup_channels_mod_select").setPlaceholder("Select moderation log channel").addChannelTypes(0).setMinValues(0).setMaxValues(1)
  )
  return i.update({ components: [row] })
}

exports.selectModChannel = async (i, interaction, session, store) => {
  session.channels.logs = i.values.length ? i.values[0] : null
  store.set(interaction.guild.id, session)
  const row = mainRows.buildChannelsRow()
  return i.update({ embeds: [previewEmbed(session)], components: [row] })
}

exports.openServerSelect = async (i) => {
  const row = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder().setCustomId("setup_channels_server_select").setPlaceholder("Select server log channel").addChannelTypes(0).setMinValues(0).setMaxValues(1)
  )
  return i.update({ components: [row] })
}

exports.selectServerChannel = async (i, interaction, session, store) => {
  session.channels.serverLogs = i.values.length ? i.values[0] : null
  store.set(interaction.guild.id, session)
  const row = mainRows.buildChannelsRow()
  return i.update({ embeds: [previewEmbed(session)], components: [row] })
}

exports.openChatSelect = async (i) => {
  const row = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder().setCustomId("setup_channels_chat_select").setPlaceholder("Select chat log channel").addChannelTypes(0).setMinValues(0).setMaxValues(1)
  )
  return i.update({ components: [row] })
}

exports.selectChatChannel = async (i, interaction, session, store) => {
  session.channels.chatLogs = i.values.length ? i.values[0] : null
  store.set(interaction.guild.id, session)
  const row = mainRows.buildChannelsRow()
  return i.update({ embeds: [previewEmbed(session)], components: [row] })
}

exports.backToMain = async (i, interaction, session, store) => {
  session.view = "main"
  store.set(interaction.guild.id, session)
  return i.update({
    embeds: [require("../../../../../messages/embeds/setup.start.embed")(interaction.guild)],
    components: [require("../builders/main.rows").buildMainRow()]
  })
}