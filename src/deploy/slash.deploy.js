require("dotenv").config()
const fs = require("fs")
const path = require("path")
const { REST, Routes } = require("discord.js")

if (!process.env.TOKEN) throw new Error("Missing TOKEN")
if (!process.env.CLIENT_ID) throw new Error("Missing CLIENT_ID")

const commands = []
const names = new Set()
const base = path.join(__dirname, "../commands")

for (const category of fs.readdirSync(base)) {
  const catPath = path.join(base, category)
  if (!fs.statSync(catPath).isDirectory()) continue

  for (const folder of fs.readdirSync(catPath)) {
    const cmdPath = path.join(catPath, folder)
    if (!fs.statSync(cmdPath).isDirectory()) continue

    const slashPath = path.join(cmdPath, "slash.js")
    if (!fs.existsSync(slashPath)) continue

    try {
      const file = require(slashPath)

      if (!file.data || !file.data.name) continue
      if (names.has(file.data.name)) {
        console.error("Duplicate slash name", file.data.name)
        continue
      }

      names.add(file.data.name)
      commands.push(file.data.toJSON())
      console.log("Prepared", file.data.name)
    } catch (err) {
      console.error("Failed to prepare", slashPath)
      console.error(err)
    }
  }
}

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN)

;(async () => {
  try {
    console.log("Deploying", commands.length, "commands")

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    )

    console.log("Deploy successful")
  } catch (err) {
    console.error("Deploy failed")
    console.error(err)
  }
})()