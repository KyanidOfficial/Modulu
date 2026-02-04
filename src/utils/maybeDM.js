const dmUser = require("./dmUser")
const db = require("../core/database")

module.exports = async (guildId, user, embed) => {
  if (!guildId || !user || !embed) {
    console.warn("[DM DEBUG] invalid arguments", {
      guildId,
      user: !!user,
      embed: !!embed
    })
    return
  }

  let data
  try {
    data = await db.get(guildId)
  } catch (err) {
    console.error("[DM DEBUG] db.get failed", err)
    return
  }

  const enabled = !!data?.setup?.features?.dmOnPunish

  console.log("[DM DEBUG]", {
    guildId,
    dmOnPunish: enabled
  })

  if (!enabled) return

  try {
    await dmUser(user, embed)
    console.log("[DM DEBUG] DM sent", user.id)
  } catch {
    console.warn("[DM DEBUG] DM failed", user.id)
  }
}