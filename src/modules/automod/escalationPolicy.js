module.exports = {
  resolveAction({ config, infractionCount, trustAdjustment = 0 }) {
    const count = infractionCount + trustAdjustment
    const rules = config.escalation

    if (count >= rules.banAt) return { actionType: "ban", severity: 4 }
    if (count >= rules.kickAt) return { actionType: "kick", severity: 3 }
    if (count >= rules.timeoutAt) return { actionType: "timeout", severity: 2, durationMs: rules.timeoutMs }
    return { actionType: "warn", severity: 1 }
  }
}
