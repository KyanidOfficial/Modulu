const { handleInteractionCreate } = require("../core/events/interactionCreate")

module.exports = (client, interaction) => handleInteractionCreate(client, interaction)
