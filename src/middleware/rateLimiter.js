const buckets = new Map()

module.exports = ({ key, ttlMs = 2000 }) => {
  const now = Date.now()
  const expires = buckets.get(key) || 0
  if (expires > now) return false
  buckets.set(key, now + ttlMs)
  return true
}
