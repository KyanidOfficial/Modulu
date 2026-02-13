require("dotenv").config()
const path = require("path")
const { REST, Routes } = require("discord.js")
const { isCommandEnabled } = require("../utils/commandToggle")
const { collectSlashCommandFiles } = require("../core/loaders/slash.scan")

if (!process.env.TOKEN) throw new Error("Missing TOKEN")
if (!process.env.CLIENT_ID) throw new Error("Missing CLIENT_ID")

const commands = []
const commandNameToFile = new Map()
const base = path.resolve(__dirname, "../commands")

const loadCommands = () => {
  const slashFiles = collectSlashCommandFiles(base)

  for (const slashPath of slashFiles) {
    const command = require(slashPath)

    if (!command || !command.data || typeof command.data.name !== "string" || !command.data.name.trim()) {
      throw new Error(`Invalid slash export in ${slashPath}: expected data.name`)
    }

    if (!isCommandEnabled(command)) {
      console.log("Skipped disabled command", command.data.name)
      continue
    }

    if (commandNameToFile.has(command.data.name)) {
      const firstPath = commandNameToFile.get(command.data.name)
      throw new Error(
        `Duplicate slash name ${command.data.name}\nfirst: ${firstPath}\nsecond: ${slashPath}`
      )
    }

    commandNameToFile.set(command.data.name, slashPath)
    commands.push(command.data.toJSON())
    console.log("Prepared", command.data.name, slashPath)
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
