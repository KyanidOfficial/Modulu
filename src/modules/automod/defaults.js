const { SHORTENER_DOMAINS, uniqueNormalized } = require("./presets")

module.exports = {
  enabled: true,
  logChannelId: null,
  trustedRoles: [],
  allowStaffBypass: true,
  cooldownMs: 15000,
  activeBannedWordPresets: [],
  rules: {
    bannedWords: {
      enabled: true,
      action: "delete_timeout",
      timeoutMs: 10 * 60 * 1000,
      words: uniqueNormalized(["free nitro", "steam gift", "discord.gg/free-nitro"])
    },
    links: {
      enabled: true,
      action: "delete_timeout",
      timeoutMs: 10 * 60 * 1000,
      mode: "block_all_links",
      blockedDomains: [],
      whitelistedDomains: [],
      shortenerDomains: SHORTENER_DOMAINS
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
  }
}
