module.exports = {
  enabled: true,
  logChannelId: null,
  trustedRoles: [],
  allowStaffBypass: true,
  rules: {
    bannedWords: {
      enabled: true,
      action: "delete_timeout",
      timeoutMs: 10 * 60 * 1000,
      words: ["free nitro", "steam gift", "discord.gg/free-nitro"]
    },
    links: {
      enabled: true,
      action: "delete_timeout",
      timeoutMs: 10 * 60 * 1000,
      blockedDomains: [],
      allowDiscordInvites: false
    },
    mentionSpam: {
      enabled: true,
      action: "delete_timeout",
      timeoutMs: 10 * 60 * 1000,
      maxMentions: 5
    },
    messageSpam: {
      enabled: true,
      action: "delete_timeout",
      timeoutMs: 10 * 60 * 1000,
      maxMessages: 8,
      windowMs: 12000,
      maxDuplicates: 4,
      duplicateWindowMs: 10000
    },
    capsSpam: {
      enabled: true,
      action: "delete_only",
      timeoutMs: 5 * 60 * 1000,
      minLength: 12,
      maxUppercaseRatio: 0.75
    }
  },
  cooldownMs: 15000
}
