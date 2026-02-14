const errorEmbed = require("../messages/embeds/error.embed")
const { handleInteractionError } = require("./observability/errorHandler")

module.exports = async (interaction, cmd) => {
  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true })
    }

    await cmd.execute(interaction)
  } catch (error) {
    await handleInteractionError({ error, interaction })

    if (!interaction.deferred && !interaction.replied) {
      try {
        await interaction.reply({ embeds: [errorEmbed("Command failed.")], ephemeral: true })
      } catch {
        return
      }
      return
    }

    try {
      await interaction.editReply({ embeds: [errorEmbed("Command failed.")] })
    } catch {
      return
    }
  }
}
