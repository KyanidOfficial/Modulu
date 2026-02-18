const fs = require("fs")
const path = require("path")

module.exports = client => {
  const base = path.join(__dirname, "..", "..", "events")

  if (!client.__loadedEventFiles) {
    Object.defineProperty(client, "__loadedEventFiles", {
      value: new Set(),
      enumerable: false,
      configurable: false,
      writable: false
    })
  }

  const load = dir => {
    for (const file of fs.readdirSync(dir)) {
      const full = path.join(dir, file)

      if (fs.statSync(full).isDirectory()) {
        load(full)
        continue
      }

      if (!file.endsWith(".js")) continue
      if (client.__loadedEventFiles.has(full)) continue

      const event = require(full)
      const name = file.split(".")[0]

      client.on(name, (...args) => event(client, ...args))
      client.__loadedEventFiles.add(full)
    }
  }

  load(base)
}
