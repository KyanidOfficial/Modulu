const { PermissionsBitField } = require("discord.js")
const logModerationAction = require("../../utils/logModerationAction")
const COLORS = require("../../utils/colors")
const { extract } = require("../../utils/linkScanner")
const { normalizeText } = require("./normalizer")
const store = require("./store")
const warningStore = require("../warnings/store")
const { moderateContent } = require("./aiModeration")

const recentMessages = new Map()

const getBucket = (guildId, userId) => {
  const key = `${guildId}:${userId}`
  if (!recentMessages.has(key)) recentMessages.set(key, [])
  return recentMessages.get(key)
}

const compact = (list, windowMs) => {
  const now = Date.now()
  while (list.length && now - list[0].ts > windowMs) list.shift()
}

const hasBypass = (member, cfg) => {
  if (!member) return true
  if (cfg.allowStaffBypass && member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return true
  if (cfg.trustedRoles?.length && member.roles.cache.hasAny(...cfg.trustedRoles)) return true
  return false
}

const buildPatterns = cfg => {
  const words = (cfg.blacklistWords || []).map(w => normalizeText(w.trim())).filter(Boolean)
  const regex = (cfg.blacklistRegex || [])
    .map(entry => {
      try {
        return new RegExp(entry, "iu")
      } catch {
        return null
      }
    })
    .filter(Boolean)
  return { words, regex }
}

const containsBlacklist = (content, patterns) => {
  const normalized = normalizeText(content)
  if (patterns.words.some(word => normalized.includes(word))) return true
  if (patterns.regex.some(re => re.test(normalized))) return true
  return false
}

const isInviteLike = normalized => /(discord\.gg|discord\.com\/invite|d1scord|disc0rd)\/?[a-z0-9-]+/i.test(normalized)

const evaluateLinks = (content, cfg) => {
  const urls = extract(content)
  const lowered = normalizeText(content)

  for (const url of urls) {
    const host = (() => {
      try {
        return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.toLowerCase()
      } catch {
        return ""
      }
    })()

    if (cfg.links.blockedDomains.includes(host)) {
      return { type: "malicious_link", reason: `Blocked domain: ${host}`, url }
    }

    if (cfg.links.blockRedirectors && cfg.links.redirectorDomains.includes(host)) {
      return { type: "malicious_link", reason: `Redirector blocked: ${host}`, url }
    }
  }

  if (cfg.links.knownScamKeywords.some(keyword => lowered.includes(normalizeText(keyword)))) {
    return { type: "malicious_link", reason: "Potential scam keyword pattern" }
  }

  if (isInviteLike(lowered)) {
    return { type: "invite", reason: "Invite link or bypass pattern detected" }
  }

  return null
}

const evaluateSpam = (message, cfg) => {
  const bucket = getBucket(message.guild.id, message.author.id)
  bucket.push({ text: normalizeText(message.content || ""), ts: Date.now(), msg: message })
  compact(bucket, Math.max(cfg.rateLimit.windowMs, cfg.spam.floodWindowMs))

  const mentionCount = message.mentions.users.size + message.mentions.roles.size
  if (mentionCount > cfg.spam.maxMentions) {
    return { type: "spam", reason: `Excessive mentions (${mentionCount})` }
  }

  const recentFlood = bucket.filter(x => Date.now() - x.ts <= cfg.spam.floodWindowMs)
  const sameCount = recentFlood.filter(x => x.text && x.text === normalizeText(message.content || "")).length
  if (sameCount >= cfg.spam.maxRepeatedMessages) {
    return { type: "spam", reason: "Repeated message flood" }
  }

  const inWindow = bucket.filter(x => Date.now() - x.ts <= cfg.rateLimit.windowMs).length
  if (inWindow > cfg.rateLimit.maxMessages) {
    return { type: "rate_limit", reason: `Rate limit exceeded (${inWindow}/${cfg.rateLimit.maxMessages})` }
  }

  return null
}

const applyPunishment = async ({ message, cfg, trigger, aiResult }) => {
  const guild = message.guild
  const member = message.member
  const userId = message.author.id

  if (!member?.moderatable) {
    await logModerationAction({
      guild,
      action: "automod_block",
      userId,
      moderatorId: guild.members.me?.id,
      reason: `${trigger.reason} (member not moderatable)`,
      color: COLORS.error,
      metadata: { trigger, ai: aiResult }
    })
    return
  }

  const inCooldown = await store.isPunishmentCoolingDown(guild.id, userId, trigger.type)
  if (inCooldown) return

  await store.addInfraction({ guildId: guild.id, userId, triggerType: trigger.type, reason: trigger.reason, metadata: { ai: aiResult } })
  const points = await store.countInfractions(guild.id, userId, trigger.type, 1440)

  const ladder = cfg.punishments[trigger.type] || cfg.punishments.default
  const action = ladder[Math.min(points - 1, ladder.length - 1)]
  const reason = `[AutoMod:${trigger.type}] ${trigger.reason}`

  await message.delete().catch(() => {})

  if (action === "warn") {
    try {
      const warningId = await warningStore.createWarning({
        guildId: guild.id,
        userId,
        moderatorId: guild.members.me?.id || "0",
        reason,
        source: "automod"
      })
      const totalWarnings = await warningStore.countWarnings(guild.id, userId)
      await logModerationAction({
        guild,
        action: "warn",
        userId,
        moderatorId: guild.members.me?.id,
        reason,
        metadata: { trigger, ai: aiResult, points, warningId, warningCount: totalWarnings },
        color: COLORS.warning
      })
    } catch (err) {
      console.error("[AUTOMOD] Failed to persist warning", err)
      await logModerationAction({
        guild,
        action: "warn_failed",
        userId,
        moderatorId: guild.members.me?.id,
        reason: `${reason} (persist failed)`,
        metadata: { trigger, ai: aiResult, points, error: err?.message },
        color: COLORS.error
      })
      return
    }
  }

  if (action === "mute") {
    const duration = points > 2 ? cfg.timeouts.longMuteMs : cfg.timeouts.muteMs
    await member.timeout(duration, reason).catch(() => {})
    await logModerationAction({ guild, action: "timeout", userId, moderatorId: guild.members.me?.id, reason, duration: `${Math.round(duration / 60000)}m`, metadata: { trigger, ai: aiResult, points }, color: COLORS.warning })
  }

  if (action === "kick") {
    await member.kick(reason).catch(() => {})
    await logModerationAction({ guild, action: "kick", userId, moderatorId: guild.members.me?.id, reason, metadata: { trigger, ai: aiResult, points }, color: COLORS.error })
  }

  if (action === "ban") {
    await member.ban({ reason, deleteMessageSeconds: 60 * 60 }).catch(() => {})
    await logModerationAction({ guild, action: "ban", userId, moderatorId: guild.members.me?.id, reason, metadata: { trigger, ai: aiResult, points }, color: COLORS.error })
  }

  await store.setPunishmentCooldown(guild.id, userId, trigger.type, cfg.rateLimit.cooldownMs)
}

module.exports.handleMessage = async message => {
  if (!message?.guild || message.author?.bot) return { blocked: false }

  const cfg = await store.getConfig(message.guild.id)
  if (!cfg.enabled || hasBypass(message.member, cfg)) return { blocked: false }

  const patterns = buildPatterns(cfg)
  const checks = []

  if (cfg.checks.blacklist && containsBlacklist(message.content || "", patterns)) {
    checks.push({ type: "blacklist", reason: "Blacklisted word/pattern detected" })
  }

  if (cfg.checks.links || cfg.checks.invites) {
    const link = evaluateLinks(message.content || "", cfg)
    if (link) checks.push(link)
  }

  if (cfg.checks.spam || cfg.checks.rateLimit || cfg.checks.mentions) {
    const spam = evaluateSpam(message, cfg)
    if (spam) checks.push(spam)
  }

  if (cfg.checks.attachments && message.attachments.size > 0) {
    for (const attachment of message.attachments.values()) {
      if (!attachment.contentType?.startsWith("image/")) continue
      checks.push({ type: "explicit_attachment", reason: "Image attachment requires moderation", imageUrl: attachment.url })
    }
  }

  if (!checks.length) return { blocked: false }

  const candidate = checks[0]
  const aiResult = cfg.checks.aiModeration
    ? await moderateContent({ text: message.content, imageUrl: candidate.imageUrl, category: candidate.type })
    : { skipped: true, reason: "AI moderation disabled" }

  if (cfg.checks.aiModeration && !aiResult.skipped && !aiResult.flagged) {
    await logModerationAction({
      guild: message.guild,
      action: "automod_review",
      userId: message.author.id,
      moderatorId: message.guild.members.me?.id,
      reason: `Trigger matched but AI moderation did not flag: ${candidate.reason}`,
      metadata: { trigger: candidate, ai: aiResult },
      color: COLORS.info
    })
    return { blocked: false }
  }

  await applyPunishment({ message, cfg, trigger: candidate, aiResult })
  return { blocked: true, reason: candidate.reason }
}
