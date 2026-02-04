const fs = require("fs")
const path = require("path")
const schema = require("./schema")

const base = path.join(__dirname, "../../../data/guilds")
if (!fs.existsSync(base)) fs.mkdirSync(base, { recursive: true })

const file = id => path.join(base, `${id}.json`)

module.exports = {
  get(id) {
    if (!fs.existsSync(file(id))) {
      fs.writeFileSync(file(id), JSON.stringify(schema.guild(), null, 2))
    }
    return JSON.parse(fs.readFileSync(file(id)))
  },

  save(id, data) {
    fs.writeFileSync(file(id), JSON.stringify(data, null, 2))
  }
}