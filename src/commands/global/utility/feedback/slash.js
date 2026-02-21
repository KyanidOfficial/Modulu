const COMMAND_ENABLED = true
const {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} = require("discord.js")

module.exports = {
  COMMAND_ENABLED,
  skipDefer: true,

  data: new SlashCommandBuilder()
    .setName("feedback")
    .setDescription("Send feedback to the bot developers"),

  async execute(interaction) {
    const modal = new ModalBuilder()
      .setCustomId("feedback_modal")
      .setTitle("Send Feedback")

    const input = new TextInputBuilder()
      .setCustomId("feedback_message")
      .setLabel("Your feedback")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(1000)

    modal.addComponents(
      new ActionRowBuilder().addComponents(input)
    )

    await interaction.showModal(modal)
  }
}