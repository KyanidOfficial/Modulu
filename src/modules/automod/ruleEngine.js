const INVITE_REGEX = /(discord\.gg|discord\.com\/invite)\/[\w-]+/i

module.exports = {
  evaluate({ message, config, stats }) {
    const thresholds = config.thresholds
    const content = message.content || ""
    const mentions = message.mentions.users.size + message.mentions.roles.size

    if (stats.messageCount >= thresholds.burstCount) {
      return { violated: true, type: "message_burst", severity: 2 }
    }

    if (stats.duplicateCount >= thresholds.duplicateCount) {
      return { violated: true, type: "duplicate_message", severity: 2 }
    }

    if (mentions >= thresholds.mentionCount) {
      return { violated: true, type: "mention_spam", severity: 2 }
    }

    if (thresholds.inviteDetection && INVITE_REGEX.test(content)) {
      return { violated: true, type: "invite_link", severity: 3 }
    }

    for (const pattern of thresholds.regexBlacklist) {
      const regex = new RegExp(pattern, "i")
      if (regex.test(content)) {
        return { violated: true, type: "regex_blacklist", severity: 3 }
      }
    }

    return { violated: false }
  }
}
