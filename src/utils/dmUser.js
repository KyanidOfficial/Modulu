module.exports = async (user, payload) => {
  if (!user || !payload) {
    throw new Error("dmUser missing user or payload")
  }

  try {
    if (payload.embeds || payload.components || payload.content) {
      await user.send(payload)
    } else {
      await user.send({ embeds: [payload] })
    }
  } catch (error) {
    console.error("[DM DEBUG] user.send failed", {
      userId: user?.id,
      error: error?.message
    })
    throw error
  }
}
