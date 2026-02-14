const errorEmbed = require("../messages/embeds/error.embed")

module.exports = async (interaction, cmd) => {
  try {
    await cmd.execute(interaction)
  } catch (err) {
    console.error(err)

    const payload = {
      embeds: [errorEmbed("Command failed.")]
    }

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(payload)
    } else {
      await interaction.reply(payload)
    }
  }
}