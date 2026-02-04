
module.exports = async (client, message) => {
  if (process.env.PREFIX_DISABLED === "true") return
  const prefix = process.env.PREFIX
  if (!message.content.startsWith(prefix)) return
  if (message.author.bot) return

  const args = message.content
    .slice(prefix.length)
    .trim()
    .split(/\s+/)

  const name = args.shift()?.toLowerCase()
  if (!name) return

  const command = client.prefixCommands.get(name)
  if (!command) return

  await command.execute(message, args)
}