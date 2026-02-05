require("dotenv").config()
const fs = require("fs")
const path = require("path")
const { REST, Routes } = require("discord.js")
const { isCommandEnabled } = require("../utils/commandToggle")

if (!process.env.TOKEN) throw new Error("Missing TOKEN")
if (!process.env.CLIENT_ID) throw new Error("Missing CLIENT_ID")

const commands = []
const names = new Set()
const errors = []
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
      if (names.has(file.data.name)) {
        throw new Error(`Duplicate slash name ${file.data.name}`)
        errors.push(`Missing data for ${slashPath}`)
        continue
      }
      if (names.has(file.data.name)) {
        errors.push(`Duplicate slash name ${file.data.name}`)
        continue
      }

      names.add(file.data.name)
      commands.push(file.data.toJSON())
      console.log("Prepared", file.data.name)
    } catch (err) {
      errors.push(`Failed to prepare ${slashPath}: ${err.message}`)
    }
  }
}

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN)

;(async () => {
  try {
    loadCommands()
    if (errors.length) {
      console.error("Command preparation failed:")
      for (const err of errors) {
        console.error("-", err)
      }
      process.exitCode = 1
      return
    }

    console.log("Deploying", commands.length, "commands")

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    )

    console.log("Deploy successful")
  } catch (err) {
    console.error("Deploy failed")
    console.error(err)
    process.exitCode = 1
  }
})()
