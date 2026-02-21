<<<<<<< HEAD
const fs = require('fs')
const path = require('path')

const exported = {}
for (const file of fs.readdirSync(__dirname)) {
  if (!file.endsWith('.js') || file === 'index.js') continue
  const key = file.replace(/\.js$/, '')
  exported[key] = require(path.join(__dirname, file))
}

module.exports = exported
=======
module.exports = {}
>>>>>>> main
