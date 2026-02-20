require("dotenv").config()
const { REST, Routes } = require("discord.js")

if (!process.env.TOKEN) throw new Error("Missing TOKEN")
if (!process.env.CLIENT_ID) throw new Error("Missing CLIENT_ID")
if (!process.env.GUILD_ID) throw new Error("Missing GUILD_ID")

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN)

;(async () => {
  try {
    console.log("Fetching existing guild commands...")

    const existing = await rest.get(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      )
    )

    console.log(`Found ${existing.length} guild commands.`)

    console.log("Deleting all guild commands...")

    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: [] }
    )

    console.log("All guild commands deleted successfully.")
  } catch (error) {
    console.error("Failed to delete guild commands:")
    console.error(error)
    process.exit(1)
  }
})()