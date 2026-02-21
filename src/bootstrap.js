const { bootstrapApp } = require("./app/bootstrap")

module.exports = async client => {
  await bootstrapApp({ client })
}
