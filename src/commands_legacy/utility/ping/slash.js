const COMMAND_ENABLED = true
const { SlashCommandBuilder } = require("discord.js")
const success = require("../../../messages/embeds/success.embed")

module.exports = {
  COMMAND_ENABLED,
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Ping"),

  async execute(interaction) {
    return interaction.reply({
      embeds: [success("Pong")]
    })
  }
}