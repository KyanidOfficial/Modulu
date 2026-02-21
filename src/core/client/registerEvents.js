const eventLoader = require("../loaders/event.loader")

const registerEvents = client => {
  eventLoader(client)
}

module.exports = {
  registerEvents
}
