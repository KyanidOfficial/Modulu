module.exports = {
  enabled: true,
  checks: {
    blacklist: true,
    spam: true,
    links: true,
    invites: true,
    mentions: true,
    rateLimit: true,
    attachments: true,
    caps: true,
    aiModeration: true
  },
  blacklistWords: ["discord.gg/free-nitro", "free nitro", "steam gift"],
  blacklistRegex: ["f+r+e+e\\s*n+i+t+r+o+"],
  trustedRoles: [],
  allowStaffBypass: true,
  spam: {
    floodWindowMs: 10000,
    maxRepeatedMessages: 4,
    maxMentions: 5,
    duplicateSimilarity: 0.9
  },
  caps: {
    minLength: 12,
    threshold: 0.75
  },
  links: {
    blockRedirectors: true,
    redirectorDomains: ["bit.ly", "tinyurl.com", "t.co", "cutt.ly", "linktr.ee"],
    knownScamKeywords: ["claim nitro", "gift nitro", "steamcommunity giveaway", "airdrop"],
    blockedDomains: []
  },
  rateLimit: {
    windowMs: 12000,
    maxMessages: 8,
    cooldownMs: 180000
  },
  punishments: {
    default: ["warn", "mute", "kick", "ban"],
    blacklist: ["warn", "mute", "kick"],
    malicious_link: ["warn", "mute", "ban"],
    invite: ["warn", "mute", "kick"],
    spam: ["warn", "mute", "kick"],
    rate_limit: ["warn", "mute", "kick"],
    caps: ["warn", "mute", "kick"],
    explicit_attachment: ["warn", "mute", "ban"]
  },
  timeouts: {
    muteMs: 15 * 60 * 1000,
    longMuteMs: 24 * 60 * 60 * 1000
  }
}
