const cosineSimilarity = (a = [], b = []) => {
  if (!a.length || !b.length || a.length !== b.length) return 0
  let dot = 0
  let magA = 0
  let magB = 0

  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i]
    magA += a[i] * a[i]
    magB += b[i] * b[i]
  }

  if (!magA || !magB) return 0
  return dot / (Math.sqrt(magA) * Math.sqrt(magB))
}

const initGuildGraph = () => ({
  nodes: {
    users: new Set(),
    channels: new Set()
  },
  edges: {
    mentions: new Map(),
    replies: new Map(),
    sharedLinks: new Map(),
    lexicalSimilarity: new Map(),
    temporalCorrelation: new Map()
  }
})

const pushEdge = (edgeMap, source, target, value, ts) => {
  const key = `${source}->${target}`
  const entries = edgeMap.get(key) || []
  entries.push({ value, ts })
  edgeMap.set(key, entries)
}

const pruneWindow = (graph, windowMs, now = Date.now()) => {
  for (const edgeMap of Object.values(graph.edges)) {
    for (const [key, entries] of edgeMap.entries()) {
      const next = entries.filter(item => now - item.ts <= windowMs)
      if (!next.length) {
        edgeMap.delete(key)
      } else {
        edgeMap.set(key, next)
      }
    }
  }
}

module.exports = {
  cosineSimilarity,
  initGuildGraph,
  pruneWindow,
  pushEdge
}
