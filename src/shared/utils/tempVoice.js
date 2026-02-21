const scheduled = new Map()

const scheduleDeletion = (channel, durationMs) => {
  if (!channel) return

  const key = channel.id
  if (scheduled.has(key)) {
    clearTimeout(scheduled.get(key))
  }

  const timeout = setTimeout(async () => {
    scheduled.delete(key)
    if (channel.deletable) {
      await channel.delete("Temporary voice channel expired").catch(() => {})
    }
  }, durationMs)

  scheduled.set(key, timeout)
}

module.exports = { scheduleDeletion }
