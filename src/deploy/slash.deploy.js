require("dotenv").config()
const fs = require("fs")
const path = require("path")
const { REST, Routes } = require("discord.js")
const { isCommandEnabled } = require("../utils/commandToggle")
const { validateCommandPayload } = require("./slash.validation")

if (!process.env.TOKEN) throw new Error("Missing TOKEN")
if (!process.env.CLIENT_ID) throw new Error("Missing CLIENT_ID")

const validateOnly = process.env.DEPLOY_VALIDATE_ONLY === "true"

const commands = []
const names = new Set()
const base = path.join(__dirname, "../commands")

const collectSlashFiles = root => {
  const files = []

  for (const category of fs.readdirSync(root)) {
    const catPath = path.join(root, category)
    if (!fs.statSync(catPath).isDirectory()) continue

    for (const folder of fs.readdirSync(catPath)) {
      const cmdPath = path.join(catPath, folder)
      if (!fs.statSync(cmdPath).isDirectory()) continue

      const slashPath = path.join(cmdPath, "slash.js")
      if (fs.existsSync(slashPath)) files.push(slashPath)
    }
  }

  return files
}

const clearSlashRequireCache = slashPaths => {
  for (const slashPath of slashPaths) {
    const resolved = require.resolve(slashPath)
    if (require.cache[resolved]) delete require.cache[resolved]
  }
}

const loadCommands = () => {
  const slashPaths = collectSlashFiles(base)
  clearSlashRequireCache(slashPaths)

  for (const slashPath of slashPaths) {
    const file = require(slashPath)
    const commandData = file?.data

    if (!commandData || !commandData.name || typeof commandData.toJSON !== "function") {
      throw new Error(`Missing or invalid slash data export for ${slashPath}`)
    }

    if (!isCommandEnabled(file)) {
      console.log("Skipped disabled command", commandData.name)
      continue
    }

    if (names.has(commandData.name)) {
      throw new Error(`Duplicate slash name ${commandData.name}`)
    }

    names.add(commandData.name)
    commands.push(commandData.toJSON())
    console.log("Prepared", commandData.name)
  }
}

const preflightValidate = payload => {
  const result = validateCommandPayload(payload)
  if (result.valid) {
    console.log(`[DEPLOY] Validation passed for ${payload.length} global command(s).`)
    return
  }

  console.error("[DEPLOY] Validation failed. Deployment aborted before Discord PUT.")
  for (const error of result.errors) {
    console.error(` - ${error}`)
  }

  process.exit(1)
}

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN)

;(async () => {
  try {
    loadCommands()
    preflightValidate(commands)

    const payload = JSON.stringify(commands)
    const payloadSize = Buffer.byteLength(payload)

    console.log("Deploying", commands.length, "commands")
    console.log("Payload size:", payloadSize)

    if (validateOnly) {
      console.log("[DEPLOY] DEPLOY_VALIDATE_ONLY=true; skipped global PUT request.")
      process.exit(0)
    }

    console.time("GLOBAL_DEPLOY")
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands })
    console.timeEnd("GLOBAL_DEPLOY")
    console.log("Global deploy successful")

    process.exit(0)
  } catch (err) {
    console.error("Deploy failed")
    console.error(err)
    process.exit(1)
  }
})()
