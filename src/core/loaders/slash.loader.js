const fs = require("fs")
const path = require("path")
const registry = require("../registry/slash.commands")
const { isCommandEnabled } = require("../../utils/commandToggle")
const { safeExecute } = require("../guards/safeExecute")

const collectSlashFiles = base => {
  const files = []
  const walk = dir => {
    for (const entry of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, entry)
      const stat = fs.statSync(fullPath)
      if (stat.isDirectory()) {
        walk(fullPath)
        continue
      }
      if (entry === "slash.js") files.push(fullPath)
    }
  }
  walk(base)
  return files
}

const isIgnorableInteractionError = err => err && (err.code === 10062 || err.code === 10008)

const wrapExecute = (commandName, execute) => {
  return async interaction => {
    try {
      return await execute(interaction)
    } catch (err) {
      console.error(`[COMMAND_ERROR] ${commandName}`)
      console.error(err?.stack || err)

      if (!interaction?.isRepliable?.()) return

      const payload = {
        content: "Something went wrong while running this command. Please try again.",
        ephemeral: true
      }

      if (interaction.replied || interaction.deferred) {
        await interaction.editReply(payload).catch(() => {})
      } else {
        await interaction.reply(payload).catch(replyError => {
          if (!isIgnorableInteractionError(replyError)) {
            console.error(replyError?.stack || replyError)
          }
        })
      }
    }
  }
}

module.exports = client => {
  console.log("Slash loader started")

  const base = path.join(__dirname, "..", "..", "commands")
  if (!fs.existsSync(base)) return

  for (const slashPath of collectSlashFiles(base)) {
    const cmdPath = path.dirname(slashPath)

    try {
      const command = require(slashPath)

      if (!command) continue
      if (!command.data || !command.data.name) {
        console.error("Missing command data", slashPath)
        continue
      }

      if (typeof command.execute !== "function") {
        console.error("Missing execute()", command.data.name)
        continue
      }

      if (!isCommandEnabled(command)) {
        console.log("Skipped disabled command", command.data.name)
        continue
      }

      if (client.commands.has(command.data.name)) {
        throw new Error(`Duplicate command name ${command.data.name} at ${slashPath}`)
      }

      const metaPath = path.join(cmdPath, "meta.js")
      command.meta = fs.existsSync(metaPath) ? require(metaPath) : {}
      command.execute = safeExecute(command.data.name, command.execute)

      registry.set(command.data.name, command)
      client.commands.set(command.data.name, command)

      console.log("Loaded slash command", command.data.name)
    } catch (err) {
      console.error("Failed to load command", slashPath)
      console.error(err)
    }
  }

  console.log("Slash loader finished", client.commands.size)
}
