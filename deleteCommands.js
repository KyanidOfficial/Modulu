// RUN THIS FILE ONCE TO DELETE ALL GLOBAL SLASH COMMANDS THEN RUN
// THE node src/deploy/slash.deploy.js TO RE-REGISTER THEM
require("dotenv").config()
const { REST, Routes } = require("discord.js")

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN)

async function run() {
  try {
    console.log("Deleting all global slash commands...")

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: [] }
    )

    console.log("All global slash commands deleted.")
  } catch (err) {
    console.error(err)
  }
}

run()