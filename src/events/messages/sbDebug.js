const safeBrowsing = require("../../utils/safeBrowsing")

module.exports = async message => {
  if (!message.content) return
  if (!message.content.startsWith("sb.debug")) return

  const parts = message.content.split(" ")
  const url = parts[1]

  if (!url) {
    await message.channel.send("sb.debug <url>")
    return
  }

  const result = await safeBrowsing.check(url, true)
  await message.channel.send(`Safe Browsing result: ${result}`)
}