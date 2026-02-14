require("dotenv").config()

const { REST, Routes } = require("discord.js")

const client = { commands: new Map() }
require("../core/loaders/slash.loader")(client)

const commands = Array.from(client.commands.values()).map(command => command.data.toJSON())
const rest = new REST({ version: "10" }).setToken(process.env.TOKEN)

;(async () => {
  await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands })
  console.log(`Deployed ${commands.length} commands`)
})().catch(error => {
  console.error(error)
  process.exitCode = 1
})
