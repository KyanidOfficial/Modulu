module.exports = {
  resolve(config, infractionCount) {
    if (infractionCount >= config.escalation.banAt) return "ban"
    if (infractionCount >= config.escalation.kickAt) return "kick"
    if (infractionCount >= config.escalation.timeoutAt) return "timeout"
    return "warn"
  }
}
