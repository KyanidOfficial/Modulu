const windows = new Map()

const getWindow = key => {
  if (!windows.has(key)) {
    windows.set(key, {
      timestamps: [],
      duplicates: new Map()
    })
  }
  return windows.get(key)
}

const prune = (data, now, windowMs) => {
  data.timestamps = data.timestamps.filter(ts => now - ts <= windowMs)
}

module.exports = {
  record({ guildId, userId, contentHash, now = Date.now(), burstWindowMs }) {
    const key = `${guildId}:${userId}`
    const data = getWindow(key)
    data.timestamps.push(now)
    prune(data, now, burstWindowMs)

    if (contentHash) {
      data.duplicates.set(contentHash, (data.duplicates.get(contentHash) || 0) + 1)
    }

    return {
      messageCount: data.timestamps.length,
      duplicateCount: contentHash ? data.duplicates.get(contentHash) || 0 : 0
    }
  }
}
