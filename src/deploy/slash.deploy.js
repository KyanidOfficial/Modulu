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

const findSlashCommandFiles = (dir, root) => {
  const files = []
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry)
    const stat = fs.statSync(full)

    if (stat.isDirectory()) {
      files.push(...findSlashCommandFiles(full, root))
      continue
    }

    if (!entry.endsWith(".js")) continue
    if (entry === "meta.js" || entry === "prefix.js") continue

    const relativeDir = path.relative(root, path.dirname(full))
    const depth = relativeDir.split(path.sep).filter(Boolean).length
    const isLegacySlashFile = entry === "slash.js"
    const isCategoryRootCommand = depth === 1

    if (!isLegacySlashFile && !isCategoryRootCommand) continue

    files.push(full)
  }

  return files
}

const loadCommands = () => {
  const commandFiles = findSlashCommandFiles(base, base)

  for (const commandPath of commandFiles) {
    const file = require(commandPath)

    if (!file.data || !file.data.name) continue
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

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN)

;(async () => {
  try {
    loadCommands()

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
