const db = require("../../core/database")

module.exports = {
  async execute({ member, message, decision, idempotencyKey }) {
    const acquired = await db.registerActionIdempotency(
      idempotencyKey,
      member.guild.id,
      member.id,
      decision.actionType
    )

    if (!acquired) return { skipped: true, actionType: decision.actionType }

    if (decision.actionType === "timeout") {
      await member.timeout(decision.durationMs, "Automod escalation")
    } else if (decision.actionType === "kick") {
      await member.kick("Automod escalation")
    } else if (decision.actionType === "ban") {
      await member.ban({ reason: "Automod escalation", deleteMessageSeconds: 0 })
    }

    if (message.deletable) {
      await message.delete()
    }

    return { skipped: false, actionType: decision.actionType }
  }
}
