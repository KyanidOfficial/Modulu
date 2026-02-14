const automod = require("../../modules/automod")

module.exports = async message => {
  await automod.handleMessage(message)
}
