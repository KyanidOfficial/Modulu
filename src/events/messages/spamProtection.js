const metrics = require("../../core/spam/metrics")
const escalation = require("../../core/spam/escalation")
const raidState = require("../../core/raid/raidState")
console.log("[SPAM DEBUG] metrics file loaded")

module.exports = async message => {
  if (!message.guild) return
  if (message.author.bot) return

  const raid = await raidState.isActive(message.guild.id)

  const result = metrics.check(message, raid)

  console.log("[SPAM DEBUG] metrics result", result?.type)

  if (!result) return

  const channel = message.channel
  const toDelete = result.messages.filter(m => !m.deleted)

  console.log("[SPAM DEBUG] deleting", toDelete.length, "messages")

  if (toDelete.length === 1) {
    await toDelete[0].delete().catch(() => {})
  } else {
    await channel.bulkDelete(toDelete, true).catch(() => {})
  }

  await escalation.handle({
    member: message.member,
    type: result.type
  })
}