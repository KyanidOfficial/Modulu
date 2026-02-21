const fs = require("fs")
const path = require("path")

const getAllSlashCommandFiles = () => {
<<<<<<< HEAD
  const root = path.join(__dirname, "global")
=======
  const root = path.join(__dirname)
>>>>>>> main
  const files = []

  const walk = dir => {
    for (const entry of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, entry)
      const stat = fs.statSync(fullPath)
      if (stat.isDirectory()) {
        walk(fullPath)
        continue
      }
      if (entry === "slash.js") files.push(fullPath)
    }
  }

  walk(root)
  return files
}

module.exports = {
  getAllSlashCommandFiles
}
