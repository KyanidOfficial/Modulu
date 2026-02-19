const path = require("path")
const { Worker } = require("worker_threads")
const { pruneWindow, pushEdge } = require("../models/guildGraph")

const updateGraphFromMessage = (graph, message, now = Date.now()) => {
  graph.nodes.users.add(message.author.id)
  graph.nodes.channels.add(message.channel.id)

  const mentionIds = [...(message.mentions?.users?.keys?.() || [])]
  for (const targetId of mentionIds) {
    pushEdge(graph.edges.mentions, message.author.id, targetId, 1, now)
  }

  if (message.reference?.messageId && message.mentions?.repliedUser?.id) {
    pushEdge(graph.edges.replies, message.author.id, message.mentions.repliedUser.id, 1, now)
  }

  const links = (String(message.content || "").match(/https?:\/\/\S+/g) || [])
  for (const link of links) {
    pushEdge(graph.edges.sharedLinks, message.author.id, message.channel.id, link, now)
  }

  pruneWindow(graph, 1000 * 60 * 30, now)
}

const detectClusterAsync = ({ graph, joinedAtMap = {}, threshold = 0.7 }) => new Promise(resolve => {
  const worker = new Worker(path.join(__dirname, "..", "workers", "graph.worker.js"))

  const serializeEdgeMap = edgeMap => {
    const output = []
    for (const entries of edgeMap.values()) output.push(...entries)
    return output
  }

  worker.once("message", result => {
    resolve(result)
    worker.terminate().catch(() => {})
  })

  worker.once("error", () => {
    resolve({ clusterCoefficient: 0, isCluster: false })
  })

  worker.postMessage({
    edges: {
      temporalCorrelation: serializeEdgeMap(graph.edges.temporalCorrelation),
      lexicalSimilarity: serializeEdgeMap(graph.edges.lexicalSimilarity),
      roleAcquisitionAnomalies: []
    },
    joinedAtMap,
    threshold
  })
})

module.exports = {
  updateGraphFromMessage,
  detectClusterAsync
}
