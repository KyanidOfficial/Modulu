const fs = require("fs")
const path = require("path")

const dir = __dirname

const versions = fs
  .readdirSync(dir)
  .filter(f => f !== "index.js" && f.endsWith(".js"))
  .map(f => require(path.join(dir, f)))
  .sort((a, b) => b.version.localeCompare(a.version))

module.exports = versions