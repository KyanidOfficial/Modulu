const interactionHandler = require("../handlers/interaction.handler")

const handleInteractionCreate = async (client, interaction) => {
  await interactionHandler(client, interaction)
}

module.exports = {
  handleInteractionCreate
}
