const fs = require("fs")
const path = require("path")
const { SlashCommandBuilder } = require("discord.js")

const NAME_REGEX = /^[a-z0-9_-]{1,32}$/
const MAX_DESCRIPTION_LENGTH = 100
const MAX_OPTIONS = 25
const MAX_CHOICES = 25
const MAX_CHOICE_VALUE_LENGTH = 100

const pushError = (errors, message) => errors.push(message)

const hasCircularReference = value => {
  const stack = new Set()
  const walk = current => {
    if (!current || typeof current !== "object") return false
    if (stack.has(current)) return true
    stack.add(current)
    const values = Array.isArray(current) ? current : Object.values(current)
    for (const item of values) {
      if (walk(item)) return true
    }
    stack.delete(current)
    return false
  }
  return walk(value)
}

const validateOptionSet = ({ options, commandName, commandPath, errors }) => {
  if (!Array.isArray(options)) return

  if (options.length > MAX_OPTIONS) {
    pushError(errors, `[${commandName}] ${commandPath} has ${options.length} options (max ${MAX_OPTIONS})`)
  }

  const seenNames = new Set()
  let encounteredOptional = false

  for (const option of options) {
    const name = option?.name

    if (!name || typeof name !== "string") {
      pushError(errors, `[${commandName}] ${commandPath} has an option without a valid name`)
      continue
    }

    if (seenNames.has(name)) {
      pushError(errors, `[${commandName}] duplicate option name: ${name}`)
    }
    seenNames.add(name)

    if (!NAME_REGEX.test(name)) {
      pushError(errors, `[${commandName}] option name is invalid: ${name}`)
    }

    if (name === commandName) {
      pushError(errors, `[${commandName}] option name cannot match command name: ${name}`)
    }

    if (!option.description || typeof option.description !== "string" || !option.description.trim()) {
      pushError(errors, `[${commandName}] option ${name} is missing a description`)
    }

    if (option.required) {
      if (encounteredOptional) {
        pushError(errors, `[${commandName}] required option appears after optional option: ${name}`)
      }
    } else {
      encounteredOptional = true
    }

    if (Array.isArray(option.choices)) {
      if (option.choices.length > MAX_CHOICES) {
        pushError(errors, `[${commandName}] option ${name} has ${option.choices.length} choices (max ${MAX_CHOICES})`)
      }

      const seenChoiceNames = new Set()
      const seenChoiceValues = new Set()

      for (const choice of option.choices) {
        if (seenChoiceNames.has(choice.name)) {
          pushError(errors, `[${commandName}] option ${name} has duplicate choice name: ${choice.name}`)
        }
        seenChoiceNames.add(choice.name)

        if (seenChoiceValues.has(choice.value)) {
          pushError(errors, `[${commandName}] option ${name} has duplicate choice value: ${choice.value}`)
        }
        seenChoiceValues.add(choice.value)

        if (String(choice.value).length > MAX_CHOICE_VALUE_LENGTH) {
          pushError(errors, `[${commandName}] option ${name} choice value exceeds ${MAX_CHOICE_VALUE_LENGTH} chars`)
        }
      }
    }

    if (Array.isArray(option.options)) {
      validateOptionSet({ options: option.options, commandName, commandPath: `${commandPath}.${name}`, errors })
    }
  }
}

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

const auditSlashModules = ({ basePath, includeDisabled = false, isCommandEnabled }) => {
  const files = collectSlashFiles(basePath)
  const errors = []
  const duplicateEntries = []
  const invalidFiles = []
  const seenCommandNames = new Map()
  const commandEntries = []

  for (const filePath of files) {
    let moduleExports

    try {
      const resolved = require.resolve(filePath)
      if (require.cache[resolved]) delete require.cache[resolved]
      moduleExports = require(filePath)
    } catch (error) {
      pushError(errors, `[LOAD] Failed to require ${filePath}: ${error.message}`)
      invalidFiles.push(filePath)
      continue
    }

    if (!moduleExports || !("data" in moduleExports) || !("execute" in moduleExports)) {
      pushError(errors, `[EXPORT] ${filePath} must export data and execute`)
      invalidFiles.push(filePath)
      continue
    }

    if (typeof moduleExports.execute !== "function") {
      pushError(errors, `[EXPORT] ${filePath} execute must be a function`)
      invalidFiles.push(filePath)
      continue
    }

    if (!(moduleExports.data instanceof SlashCommandBuilder)) {
      pushError(errors, `[DATA] ${filePath} data must be an instance of SlashCommandBuilder`)
      invalidFiles.push(filePath)
      continue
    }

    let json
    try {
      json = moduleExports.data.toJSON()
    } catch (error) {
      pushError(errors, `[JSON] Failed toJSON for ${filePath}: ${error.message}`)
      invalidFiles.push(filePath)
      continue
    }

    const commandName = json?.name

    if (!commandName || typeof commandName !== "string") {
      pushError(errors, `[COMMAND] ${filePath} is missing a command name`)
      invalidFiles.push(filePath)
      continue
    }

    const existing = seenCommandNames.get(commandName)
    if (existing) {
      duplicateEntries.push({ name: commandName, firstPath: existing, secondPath: filePath })
      pushError(errors, `[DUPLICATE] ${commandName}: ${existing} and ${filePath}`)
      invalidFiles.push(filePath)
      continue
    }

    seenCommandNames.set(commandName, filePath)

    if (!NAME_REGEX.test(commandName)) {
      pushError(errors, `[COMMAND] ${filePath} has invalid command name: ${commandName}`)
      invalidFiles.push(filePath)
      continue
    }

    const description = json?.description
    if (!description || typeof description !== "string" || description.length < 1 || description.length > MAX_DESCRIPTION_LENGTH) {
      pushError(errors, `[COMMAND] ${filePath} has invalid description length for ${commandName}`)
      invalidFiles.push(filePath)
      continue
    }

    if (hasCircularReference(json)) {
      pushError(errors, `[JSON] ${filePath} contains circular references`)
      invalidFiles.push(filePath)
      continue
    }

    try {
      JSON.stringify(json)
    } catch (error) {
      pushError(errors, `[JSON] ${filePath} is not serializable: ${error.message}`)
      invalidFiles.push(filePath)
      continue
    }

    validateOptionSet({ options: json.options, commandName, commandPath: filePath, errors })

    const enabled = typeof isCommandEnabled === "function" ? isCommandEnabled(moduleExports) : true
    if (!enabled && !includeDisabled) {
      continue
    }

    commandEntries.push({
      filePath,
      commandName,
      module: moduleExports,
      json
    })
  }

  const invalidCount = new Set(invalidFiles).size + Math.max(0, errors.length - invalidFiles.length)

  return {
    files,
    commandEntries,
    errors,
    duplicateEntries,
    invalidCount,
    duplicateCount: duplicateEntries.length
  }
}

module.exports = {
  auditSlashModules,
  MAX_OPTIONS,
  MAX_CHOICES
}
