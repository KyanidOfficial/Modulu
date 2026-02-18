const { SHORTENER_DOMAINS, uniqueNormalized } = require("./presets")

module.exports = {
  enabled: true,
  logChannelId: null,
  trustedRoles: [],
  allowStaffBypass: true,
  allowWebhookMessages: false,
  ignoredChannels: [],
  ignoredCategories: [],
  ignoredUsers: [],
  whitelistedUsers: [],
  cooldownMs: 15000,
  scoreThresholds: {
    warn: 5,
    delete: 10,
    timeout: 15
  },
  activeBannedWordPresets: [],
  rules: {
    bannedWords: {
      enabled: true,
      action: "delete_timeout",
      timeoutMs: 10 * 60 * 1000,
      score: 10,
      words: uniqueNormalized(["free nitro", "steam gift", "discord.gg/free-nitro"])
    },
    links: {
      enabled: true,
      action: "delete_timeout",
      timeoutMs: 10 * 60 * 1000,
      allowDiscordInvites: false,
      blockRedirectors: true,
      scoreInvite: 10,
      scoreBlockedDomain: 8,
      scoreRedirector: 6,
      scoreScamKeyword: 8,
      blockedDomains: [],
      whitelistedDomains: [],
      shortenerDomains: SHORTENER_DOMAINS,
      redirectorDomains: ["grabify.link", "iplogger.org", "2no.co", "adf.ly"],
      knownScamKeywords: ["free nitro", "steam gift", "airdrop", "wallet connect"]
    },
    mentionSpam: {
      enabled: true,
      action: "delete_timeout",
      timeoutMs: 10 * 60 * 1000,
      score: 6,
      maxMentions: 5
    },
    messageSpam: {
      enabled: true,
      action: "delete_timeout",
      timeoutMs: 10 * 60 * 1000,
      maxMessages: 10,
      windowMs: 15000,
      maxDuplicates: 4,
      duplicateWindowMs: 15000,
      similarityThreshold: 0.7,
      minMessagesForEvaluation: 3,
      minMessageLength: 5,
      scoreRate: 5,
      scoreSimilarity: 5,
      scoreDuplicate: 2
    },
    capsSpam: {
      enabled: true,
      action: "delete_only",
      timeoutMs: 5 * 60 * 1000,
      score: 4,
      minLength: 20,
      maxUppercaseRatio: 0.75
    }
  }
}
