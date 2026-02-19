const http = require("http")

const startModeratorApi = ({ simService, port }) => {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`)
    res.setHeader("content-type", "application/json")

    if (req.method === "GET" && /^\/sim\/user\/.+/.test(url.pathname)) {
      const userId = url.pathname.split("/").pop()
      const guildId = url.searchParams.get("guildId")
      res.end(JSON.stringify(simService.getUserReport(guildId, userId)))
      return
    }

    if (req.method === "GET" && url.pathname === "/sim/cluster") {
      const guildId = url.searchParams.get("guildId")
      res.end(JSON.stringify(simService.getClusterReport(guildId)))
      return
    }

    if (req.method === "GET" && /^\/sim\/evidence\/.+/.test(url.pathname)) {
      const sessionId = url.pathname.split("/").pop()
      res.end(JSON.stringify(simService.getEvidence(sessionId)))
      return
    }

    res.statusCode = 404
    res.end(JSON.stringify({ error: "not_found" }))
  })

  server.listen(port, () => console.log(`[SIM] Moderator API listening on ${port}`))
  return server
}

module.exports = {
  startModeratorApi
}
