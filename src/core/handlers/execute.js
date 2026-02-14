const safeReply = require("../../utils/safeReply")
const errorEmbed = require("../../messages/embeds/error.embed")

module.exports = async (interaction, command) => {
  try {
    await command.execute(interaction)
  } catch (error) {
    await safeReply(interaction, { embeds: [errorEmbed("Command failed.")] })
  }
}
