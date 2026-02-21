const { PermissionsBitField, EmbedBuilder } = require("discord.js")
const { extract } = require("../../shared/utils/linkScanner")
const safeBrowsing = require("../../shared/utils/safeBrowsing")
const harmfulLinksDb = require("../../core/database/harmfulLinks")
const serverLog = require("../../shared/utils/logServerEvent")

module.exports = async message => {
  if (!message?.guild) return
  if (!message.content) return
  if (message.author.bot) return

  const member = message.member
  if (!member) return

  const config = await harmfulLinksDb.get(message.guild.id)
  if (!config || !config.enabled) return

  const isStaff =
    member.permissions.has(PermissionsBitField.Flags.Administrator) ||
    member.permissions.has(PermissionsBitField.Flags.ManageGuild) ||
    member.permissions.has(PermissionsBitField.Flags.ManageMessages)

  if (isStaff && !config.scan_staff) return

  const urls = extract(message.content)
  if (!urls.length) return

  for (const raw of urls) {
    const url = raw.startsWith("http") ? raw : `https://${raw}`

    let result
    try {
      result = await safeBrowsing.check(url)
    } catch {
      continue
    }

    if (!result) continue

    await message.delete().catch(() => {})

    if (config.timeout && member.moderatable) {
      await member
        .timeout(config.timeout_time * 1000, "Harmful link detected")
        .catch(() => {})
    }

    if (config.log_enabled) {
      const embed = new EmbedBuilder()
        .setColor(0xff3b3b)
        .setTitle("Harmful link blocked")
        .setDescription(
          `${message.author} posted a malicious link\n` +
          `> URL: ${url}`
        )
        .setTimestamp()

      await serverLog(message.guild, embed)
    }

    return
  }
}