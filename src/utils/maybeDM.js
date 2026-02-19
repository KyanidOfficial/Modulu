const sendDM = require("./dmUser")
const db = require("../core/database")

module.exports = async (guildId, userLike, embed) => {
  if (!guildId || !userLike || !embed) {
    const err = new Error("[DM DEBUG] invalid arguments")
    console.warn(err.message, {
      guildId,
      hasUser: !!userLike,
      hasEmbed: !!embed
    })
    throw err
  }

  const user = userLike.user ?? userLike

  if (!user || !user.id) {
    const err = new Error("[DM DEBUG] invalid user object")
    console.warn(err.message)
    throw err
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
    return { sent: false, reason: "disabled" }
  }

  try {
    await sendDM(user, embed)
    console.log("[DM DEBUG] DM sent", user.id)
    return { sent: true }
  } catch (err) {
    console.error("[DM DEBUG] DM failed", {
      userId: user.id,
      code: err?.code,
      message: err?.message
    })
    throw err
  }
}
