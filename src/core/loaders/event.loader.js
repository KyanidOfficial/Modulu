const fs = require("fs")
const path = require("path")
const { handleClientError } = require("../observability/errorHandler")

module.exports = client => {
  const base = path.join(__dirname, "..", "..", "events")

  const load = dir => {
    for (const file of fs.readdirSync(dir)) {
      const full = path.join(dir, file)

      if (fs.statSync(full).isDirectory()) {
        load(full)
        continue
      }

      if (!file.endsWith(".js")) continue

      const event = require(full)
      const name = file.split(".")[0]

      client.on(name, async (...args) => {
        try {
          await event(client, ...args)
        } catch (error) {
          handleClientError({
            error,
            event: `event.${name}`,
            context: { file: full }
          })
        }
      })
    }
  }

  load(base)
}
