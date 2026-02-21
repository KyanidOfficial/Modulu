require("dotenv").config()
const path = require("path")
const { REST, Routes } = require("discord.js")
const { isCommandEnabled } = require("../utils/commandToggle")
const { validateCommandPayload } = require("./slash.validation")
const { auditSlashModules } = require("./slash.audit")

if (!process.env.TOKEN) throw new Error("Missing TOKEN")
if (!process.env.CLIENT_ID) throw new Error("Missing CLIENT_ID")

const validateOnly = process.env.DEPLOY_VALIDATE_ONLY === "true"
const basePath = path.join(__dirname, "../commands")
const rest = new REST({ version: "10" }).setToken(process.env.TOKEN)

const logAuditSummary = ({ commandCount, duplicateCount, invalidCount, payloadSize, ready }) => {
  console.log("[AUDIT] Command count:", commandCount)
  console.log("[AUDIT] Duplicate count:", duplicateCount)
  console.log("[AUDIT] Invalid count:", invalidCount)
  console.log("[AUDIT] Payload size:", payloadSize)
  console.log("[AUDIT] Ready for global deploy:", ready)
}

const preflightValidate = payload => {
  const result = validateCommandPayload(payload)
  if (result.valid) {
    console.log(`[DEPLOY] Validation passed for ${payload.length} global command(s).`)
    return { valid: true, errors: [] }
  }

  console.error("[DEPLOY] Validation failed. Deployment aborted before Discord PUT.")
  for (const error of result.errors) {
    console.error(` - ${error}`)
  }

  return result
}

;(async () => {
  try {
    const audit = auditSlashModules({
      basePath,
      includeDisabled: false,
      isCommandEnabled
    })

    const commands = audit.commandEntries.map(entry => entry.json)

    for (const entry of audit.commandEntries) {
      console.log("Prepared", entry.commandName)
    }

    const payload = JSON.stringify(commands)
    const payloadSize = Buffer.byteLength(payload)

    if (payloadSize > 20000) {
      console.warn(`[DEPLOY] Warning: payload size ${payloadSize} exceeds 20000 bytes.`)
    }

    const preflight = preflightValidate(commands)

    const ready = audit.errors.length === 0 && preflight.valid
    const invalidCount = audit.errors.length + (preflight.errors?.length || 0)

    logAuditSummary({
      commandCount: commands.length,
      duplicateCount: audit.duplicateCount,
      invalidCount,
      payloadSize,
      ready
    })

    if (!ready) {
      for (const error of audit.errors) {
        console.error(` - ${error}`)
      }
      process.exit(1)
    }

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
