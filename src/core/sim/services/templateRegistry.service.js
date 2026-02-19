const fs = require("fs")
const path = require("path")

const loadTemplates = () => {
  const base = path.join(__dirname, "..", "templates")
  const templates = []

  for (const file of fs.readdirSync(base)) {
    if (!file.endsWith(".json")) continue
    const full = path.join(base, file)
    const raw = JSON.parse(fs.readFileSync(full, "utf8"))
    templates.push(raw)
  }

  return templates
}

module.exports = {
  loadTemplates
}
