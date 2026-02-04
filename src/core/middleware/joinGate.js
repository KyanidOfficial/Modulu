const joinGateDb = require("../database/joinGate")

module.exports = async member => {
  console.log("[JOIN GATE] check start", member.user.tag)

  const gate = await joinGateDb.get(member.guild.id)

  console.log("[JOIN GATE] config", gate)

  if (!gate.enabled) {
    console.log("[JOIN GATE] disabled")
    return null
  }

  const reasons = []

  const ageDays =
    (Date.now() - member.user.createdAt.getTime()) / 86400000

  console.log("[JOIN GATE] values", {
    ageDays,
    limit: gate.account_age_days,
    hasAvatar: !!member.user.avatar,
    requireAvatar: gate.require_avatar
  })

  if (ageDays < gate.account_age_days) {
    reasons.push("your account is too new")
  }

  if (gate.require_avatar && !member.user.avatar) {
    reasons.push("your account has no profile picture")
  }

  if (!reasons.length) {
    console.log("[JOIN GATE] passed")
    return null
  }

  console.log("[JOIN GATE] triggered", reasons)

  return {
    reason: reasons.join(", "),
    categoryId: gate.category_id
  }
}