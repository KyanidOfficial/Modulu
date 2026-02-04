const { ActionRowBuilder, RoleSelectMenuBuilder } = require("discord.js")
const mainRows = require("../builders/main.rows")
const previewEmbed = require("../../../../messages/embeds/setup.preview.embed")

exports.openRoles = async (i, interaction, session, store) => {
  session.view = "roles"
  store.set(interaction.guild.id, session)
  const row = mainRows.buildRolesRow()
  return i.update({ embeds: [previewEmbed(session)], components: [row] })
}

exports.openModeratorSelect = async (i) => {
  const row = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder().setCustomId("setup_roles_moderator_select").setPlaceholder("Select moderator roles").setMinValues(0).setMaxValues(5)
  )
  return i.update({ components: [row] })
}

exports.selectModeratorRoles = async (i, interaction, session, store) => {
  session.roles.moderators = i.values
  store.set(interaction.guild.id, session)
  const row = mainRows.buildRolesRow()
  return i.update({ embeds: [previewEmbed(session)], components: [row] })
}

exports.openAdminSelect = async (i) => {
  const row = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder().setCustomId("setup_roles_admin_select").setPlaceholder("Select administrator roles").setMinValues(0).setMaxValues(5)
  )
  return i.update({ components: [row] })
}

exports.selectAdminRoles = async (i, interaction, session, store) => {
  session.roles.administrators = i.values
  store.set(interaction.guild.id, session)
  const row = mainRows.buildRolesRow()
  return i.update({ embeds: [previewEmbed(session)], components: [row] })
}

exports.backToMain = async (i, interaction, session, store) => {
  session.view = "main"
  store.set(interaction.guild.id, session)
  return i.update({
    embeds: [require("../../../../messages/embeds/setup.start.embed")(interaction.guild)],
    components: [require("../builders/main.rows").buildMainRow()]
  })
}