const map = new Map()

module.exports = (userId, key, seconds) => {
  const now = Date.now()
  const id = `${userId}:${key}`

  const until = map.get(id) || 0
  if (now < until) return true

  map.set(id, now + seconds * 1000)
  return false
}