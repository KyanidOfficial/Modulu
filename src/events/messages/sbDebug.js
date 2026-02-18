const safeBrowsing = require("../../utils/safeBrowsing")
const systemEmbed = require("../../messages/embeds/system.embed")
const COLORS = require("../../utils/colors")

module.exports = async message => {
  if (!message.content) return
  if (!message.content.startsWith("sb.debug")) return

  const parts = message.content.split(" ")
  const url = parts[1]

  if (!url) {
    await message.channel.send({
      embeds: [
        systemEmbed({
          title: "Safe Browsing Debug",
          description: "Usage: `sb.debug <url>`",
          color: COLORS.info
        })
      ]
    })
    return
  }

  const result = await safeBrowsing.check(url, true)
  await message.channel.send({
    embeds: [
      systemEmbed({
        title: "Safe Browsing Debug",
        description: `Result: **${result ? "malicious" : "clean"}** for ${url}`,
        color: result ? COLORS.error : COLORS.success
      })
    ]
  })
}
