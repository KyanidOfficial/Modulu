const success = require("../../../../messages/embeds/success.embed")

module.exports = {
  name: "ping",
  async execute(msg) {
    return msg.channel.send({
      embeds: [success("Pong")]
    })
  }
}