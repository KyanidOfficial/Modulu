const { SlashCommandBuilder } = require("discord.js")
const success = require("../../../messages/embeds/success.embed")

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Ping"),

  async execute(interaction) {
    return interaction.reply({
      embeds: [success("Pong")]
    })
  }
}