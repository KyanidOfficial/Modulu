module.exports = async (user, payload) => {
  if (!user || !payload) return

  try {
    if (payload.embeds || payload.components) {
      await user.send(payload)
    } else {
      await user.send({ embeds: [payload] })
    }
  } catch {
    // DM closed or blocked. Ignore.
  }
}