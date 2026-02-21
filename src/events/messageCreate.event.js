const { handleMessageCreate } = require("../core/events/messageCreate")

module.exports = (client, message) => handleMessageCreate(client, message)
