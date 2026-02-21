const { createClient } = require("../core/client/createClient")

const createContainer = () => {
  const client = createClient()
  return { client }
}

module.exports = {
  createContainer
}
