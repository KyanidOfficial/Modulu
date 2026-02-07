const sendDM = require("./dmUser")
const db = require("../core/database")

module.exports = async (guildId, userLike, embed) => {
  if (!guildId || !userLike || !embed) {
    console.warn("[DM DEBUG] invalid arguments", {
      guildId,
      hasUser: !!userLike,
      hasEmbed: !!embed
    })
    return
  }

  const user = userLike.user ?? userLike

  if (!user || !user.id) {
    console.warn("[DM DEBUG] invalid user object")
    return
  }

  let enabled = true

  try {
    const data = await db.get(guildId)
    if (data?.setup?.features?.dmOnPunish !== undefined) {
      enabled = !!data.setup.features.dmOnPunish
    }
  } catch (err) {
    console.error("[DM DEBUG] db.get failed", err)
  }

  if (!enabled) {
    console.log("[DM DEBUG] DM disabled by config", guildId)
    return
  }

  try {
    await sendDM(user, embed)
    console.log("[DM DEBUG] DM sent", user.id)
  } catch (err) {
    console.warn("[DM DEBUG] DM failed", {
      userId: user.id,
      code: err?.code,
      message: err?.message
    })
  }
}