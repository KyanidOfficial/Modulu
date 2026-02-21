const MAX_COMMANDS = 100
const MAX_NAME_LENGTH = 32
const MAX_DESCRIPTION_LENGTH = 100
const MAX_OPTIONS = 25
const MAX_CHOICES = 25
const NAME_REGEX = /^[a-z0-9_-]{1,32}$/

const isNonEmptyString = value => typeof value === "string" && value.trim().length > 0

const pushError = (errors, message) => {
  errors.push(message)
}

const validateChoices = ({ commandName, optionName, choices, errors }) => {
  if (!Array.isArray(choices)) return

  if (choices.length > MAX_CHOICES) {
    pushError(errors, `[${commandName}] option ${optionName} has ${choices.length} choices (max ${MAX_CHOICES})`)
  }

  const seenNames = new Set()
  const seenValues = new Set()

  for (const choice of choices) {
    if (!isNonEmptyString(choice?.name)) {
      pushError(errors, `[${commandName}] option ${optionName} has a choice without a valid name`)
      continue
    }

    if (seenNames.has(choice.name)) {
      pushError(errors, `[${commandName}] option ${optionName} has duplicate choice name ${choice.name}`)
    }
    seenNames.add(choice.name)

    if (seenValues.has(choice.value)) {
      pushError(errors, `[${commandName}] option ${optionName} has duplicate choice value ${choice.value}`)
    }
    seenValues.add(choice.value)

    if (String(choice.value).length > 100) {
      pushError(errors, `[${commandName}] option ${optionName} has choice value longer than 100 characters`)
    }
  }
}

const validateOptions = ({ commandName, options, path = "options", errors }) => {
  if (!Array.isArray(options)) return

  if (options.length > MAX_OPTIONS) {
    pushError(errors, `[${commandName}] ${path} has ${options.length} entries (max ${MAX_OPTIONS})`)
  }

  const seenNames = new Set()
  let optionalSeen = false

  for (const option of options) {
    const optionName = option?.name || "<unnamed>"
    const optionPath = `${path}.${optionName}`

    if (!isNonEmptyString(option?.name)) {
      pushError(errors, `[${commandName}] ${optionPath} is missing a valid name`)
      continue
    }

    if (!NAME_REGEX.test(option.name)) {
      pushError(errors, `[${commandName}] ${optionPath} has an invalid option name`)
    }

    if (seenNames.has(option.name)) {
      pushError(errors, `[${commandName}] ${path} has duplicate option name ${option.name}`)
    }
    seenNames.add(option.name)

    if (option.name === commandName) {
      pushError(errors, `[${commandName}] ${optionPath} cannot match command name`)
    }

    if (option.name.length > MAX_NAME_LENGTH) {
      pushError(errors, `[${commandName}] ${optionPath} name exceeds ${MAX_NAME_LENGTH} chars`)
    }

    if (!isNonEmptyString(option?.description)) {
      pushError(errors, `[${commandName}] ${optionPath} is missing a valid description`)
    } else if (option.description.length > MAX_DESCRIPTION_LENGTH) {
      pushError(errors, `[${commandName}] ${optionPath} description exceeds ${MAX_DESCRIPTION_LENGTH} chars`)
    }

    if (option.required) {
      if (optionalSeen) {
        pushError(errors, `[${commandName}] ${optionPath} is required but appears after optional options`)
      }
    } else {
      optionalSeen = true
    }

    validateChoices({ commandName, optionName: option.name, choices: option?.choices, errors })
    validateOptions({ commandName, options: option?.options, path: `${optionPath}.options`, errors })
  }
}

const validateCommandPayload = commands => {
  const errors = []

  if (!Array.isArray(commands)) {
    return { valid: false, errors: ["Command payload must be an array"] }
  }

  if (commands.length > MAX_COMMANDS) {
    pushError(errors, `Command payload has ${commands.length} commands (max ${MAX_COMMANDS})`)
  }

  const seen = new Set()

  for (const command of commands) {
    const name = command?.name

    if (!isNonEmptyString(name)) {
      pushError(errors, "Command is missing a valid name")
      continue
    }

    if (!NAME_REGEX.test(name)) {
      pushError(errors, `[${name}] command name is invalid`)
    }

    if (seen.has(name)) {
      pushError(errors, `Duplicate command name detected: ${name}`)
    }
    seen.add(name)

    if (name.length > MAX_NAME_LENGTH) {
      pushError(errors, `[${name}] command name exceeds ${MAX_NAME_LENGTH} chars`)
    }

    if (!isNonEmptyString(command?.description)) {
      pushError(errors, `[${name}] missing a valid description`)
    } else if (command.description.length > MAX_DESCRIPTION_LENGTH) {
      pushError(errors, `[${name}] description exceeds ${MAX_DESCRIPTION_LENGTH} chars`)
    }

    validateOptions({ commandName: name, options: command?.options, errors })
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

module.exports = {
  validateCommandPayload,
  constants: {
    MAX_COMMANDS,
    MAX_NAME_LENGTH,
    MAX_DESCRIPTION_LENGTH,
    MAX_OPTIONS,
    MAX_CHOICES
  }
}
