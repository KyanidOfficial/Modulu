const isCommandEnabled = command => {
  if (!command) return false
  if (command.COMMAND_ENABLED === false) return false
  return true
}

const requireEnabled = command => {
  if (isCommandEnabled(command)) return { ok: true }
  return {
    ok: false,
    reason: "This command is disabled by developers."
  }
}

module.exports = { isCommandEnabled, requireEnabled }
