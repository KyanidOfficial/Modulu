const { SlashCommandBuilder } = require("discord.js")
const safeReply = require("../../../utils/safeReply")
const success = require("../../../messages/embeds/success.embed")

module.exports = {
  data: new SlashCommandBuilder().setName("ping").setDescription("Ping"),
  async execute(interaction) {
    await safeReply(interaction, { embeds: [success("Pong")] })
  }
}
