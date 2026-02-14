const validateEmbed = require("./validateEmbed")

module.exports = async (interaction, payload) => {
  const next = { ...payload }
  if (next.embeds) {
    next.embeds = next.embeds.filter(validateEmbed)
  }

  if (interaction.deferred || interaction.replied) {
    return interaction.editReply(next)
  }

  return interaction.reply(next)
}
