require("dotenv").config()
const fs = require("fs")
const path = require("path")
const { REST, Routes } = require("discord.js")
const { isCommandEnabled } = require("../utils/commandToggle")

if (!process.env.TOKEN) throw new Error("Missing TOKEN")
if (!process.env.CLIENT_ID) throw new Error("Missing CLIENT_ID")

const useGuildDeploy = process.env.USE_GUILD_DEPLOY === "true"
if (useGuildDeploy && !process.env.GUILD_ID) {
  throw new Error("Missing GUILD_ID for USE_GUILD_DEPLOY=true")
}

const commands = []
const names = new Set()
const base = path.join(__dirname, "../commands")

const loadCommands = () => {
  for (const category of fs.readdirSync(base)) {
    const catPath = path.join(base, category)
    if (!fs.statSync(catPath).isDirectory()) continue

    for (const folder of fs.readdirSync(catPath)) {
      const cmdPath = path.join(catPath, folder)
      if (!fs.statSync(cmdPath).isDirectory()) continue

      const slashPath = path.join(cmdPath, "slash.js")
      if (!fs.existsSync(slashPath)) continue

      const file = require(slashPath)

      if (!file.data || !file.data.name) {
        throw new Error(`Missing data for ${slashPath}`)
      }
      if (names.has(file.data.name)) {
        throw new Error(`Duplicate slash name ${file.data.name}`)
      }

      if (!isCommandEnabled(file)) {
        console.log("Skipped disabled command", file.data.name)
        continue
      }

      names.add(file.data.name)
      commands.push(file.data.toJSON())
      console.log("Prepared", file.data.name)
    }
  }
}

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN)

;(async () => {
  try {
    loadCommands()

    const payload = JSON.stringify(commands)
    const payloadSize = Buffer.byteLength(payload)

    const route = Routes.applicationCommands(process.env.CLIENT_ID)

    console.log("Deploying", commands.length, "commands")
    console.log("Payload size:", payloadSize)

    await rest.put(route, { body: commands })

    console.log("Global deploy successful")
  } catch (err) {
    console.error("Deploy failed")
    console.error(err)
    process.exitCode = 1
  }
})()
