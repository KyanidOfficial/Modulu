require("dotenv").config()
const fs = require("fs")
const path = require("path")
const { REST, Routes } = require("discord.js")
const { isCommandEnabled } = require("../utils/commandToggle")

if (!process.env.TOKEN) throw new Error("Missing TOKEN")
if (!process.env.CLIENT_ID) throw new Error("Missing CLIENT_ID")

const commands = []
const names = new Set()
const base = path.join(__dirname, "../commands")

const findSlashFiles = dir => {
  const files = []

  for (const entry of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, entry)
    const stat = fs.statSync(fullPath)

    if (stat.isDirectory()) {
      files.push(...findSlashFiles(fullPath))
      continue
    }

    if (entry !== "slash.js") continue
    files.push(fullPath)
  }

  return files
}

const loadCommands = () => {
  const slashFiles = findSlashFiles(base)

  for (const slashPath of slashFiles) {
    const command = require(slashPath)
    if (!command?.data?.name) continue

    if (!isCommandEnabled(command)) {
      console.log("Skipped disabled command", command.data.name)
      continue
    }

    if (names.has(command.data.name)) {
      throw new Error(`Duplicate slash name ${command.data.name}`)
    }

    names.add(command.data.name)
    commands.push(command.data.toJSON())
    console.log("Prepared", command.data.name)
  }

}

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN)

;(async () => {
  try {
    loadCommands()
    console.log("Deploying", commands.length, "commands")

    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
      body: commands
    })

    console.log("Deploy successful")
  } catch (error) {
    console.error("Deploy failed")
    console.error(error)
    process.exitCode = 1
  }
})()
