const { PermissionsBitField } = require("discord.js")
const logModerationAction = require("../../utils/logModerationAction")
const COLORS = require("../../utils/colors")
const { extract } = require("../../utils/linkScanner")
const { normalizeText } = require("./normalizer")
const store = require("./store")
const warningStore = require("./warnings.store")
const { moderateContent } = require("./aiModeration")
const { escapeMarkdownSafe } = require("../../utils/safeText")

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

const safePreview = value => {
  const normalized = String(value || "").replace(/\s+/g, " ").trim()
  if (!normalized) return "[no text content]"
  const escaped = escapeMarkdownSafe(normalized)
  return escaped.length > 220 ? `${escaped.slice(0, 217)}...` : escaped
}

const hasBypass = (member, cfg) => {
  if (!member) return true
  if (member.permissions.has(PermissionsBitField.Flags.Administrator)) return true
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
      return { type: "malicious_link", rule: "blocked_domain", reason: `Blocked domain: ${host}`, url }
    }

    if (cfg.links.blockRedirectors && cfg.links.redirectorDomains.includes(host)) {
      return { type: "malicious_link", rule: "redirector", reason: `Redirector blocked: ${host}`, url }
    }
  }

  if (cfg.links.knownScamKeywords.some(keyword => lowered.includes(normalizeText(keyword)))) {
    return { type: "malicious_link", rule: "scam_keyword", reason: "Potential scam keyword pattern" }
  }

  if (isInviteLike(lowered)) {
    return { type: "invite", rule: "invite_link", reason: "Invite link or bypass pattern detected" }
  }

  return null
}

const evaluateCaps = (content, cfg) => {
  const text = String(content || "")
  const letters = text.replace(/[^a-z]/gi, "")
  if (letters.length < (cfg.caps?.minLength || 12)) return null

  const uppercase = letters.replace(/[^A-Z]/g, "")
  const ratio = uppercase.length / letters.length
  if (ratio >= (cfg.caps?.threshold || 0.75)) {
    return {
      type: "caps",
      rule: "caps_ratio",
      reason: `Excessive caps (${Math.round(ratio * 100)}%)`
    }
  }

  return null
}

const evaluateSpam = (message, cfg) => {
  const bucket = getBucket(message.guild.id, message.author.id)
  bucket.push({ text: normalizeText(message.content || ""), ts: Date.now(), msg: message })
  compact(bucket, Math.max(cfg.rateLimit.windowMs, cfg.spam.floodWindowMs))

  const mentionCount = message.mentions.users.size + message.mentions.roles.size
  if (cfg.checks.mentions && mentionCount > cfg.spam.maxMentions) {
    return { type: "spam", rule: "mention_spam", reason: `Excessive mentions (${mentionCount})` }
  }

  const recentFlood = bucket.filter(x => Date.now() - x.ts <= cfg.spam.floodWindowMs)
  const sameCount = recentFlood.filter(x => x.text && x.text === normalizeText(message.content || "")).length
  if (cfg.checks.spam && sameCount >= cfg.spam.maxRepeatedMessages) {
    return { type: "spam", rule: "repeated_messages", reason: "Repeated message flood" }
  }

  const inWindow = bucket.filter(x => Date.now() - x.ts <= cfg.rateLimit.windowMs).length
  if (cfg.checks.rateLimit && inWindow > cfg.rateLimit.maxMessages) {
    return { type: "rate_limit", rule: "message_rate", reason: `Rate limit exceeded (${inWindow}/${cfg.rateLimit.maxMessages})` }
  }

  return null
}

const logAutomod = async ({ message, action, trigger, reason, color, metadata = {} }) => {
  await logModerationAction({
    guild: message.guild,
    action,
    userId: message.author.id,
    moderatorId: message.guild.members.me?.id,
    reason,
    color,
    metadata: {
      ...metadata,
      trigger: trigger || null,
      automod: {
        ruleName: trigger?.rule || trigger?.type || "unknown",
        triggerType: trigger?.type || "unknown",
        actionTaken: action,
        channelId: message.channel?.id || null,
        messageId: message.id,
        messagePreview: safePreview(message.content),
        userId: message.author.id
      }
    }
  })
}

const applyPunishment = async ({ message, cfg, trigger, aiResult }) => {
  const guild = message.guild
  const member = message.member
  const userId = message.author.id

  if (!member) return

  const inCooldown = await store.isPunishmentCoolingDown(guild.id, userId, trigger.type)
  if (inCooldown) {
    await logAutomod({
      message,
      action: "automod_skipped",
      trigger,
      reason: `${trigger.reason} (cooldown active)`,
      color: COLORS.info,
      metadata: { ai: aiResult }
    })
    return
  }

  await store.setPunishmentCooldown(guild.id, userId, trigger.type, 10_000)

  const botMember = guild.members.me
  if (!botMember?.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
    await logAutomod({
      message,
      action: "automod_permission_error",
      trigger,
      reason: "Missing ManageMessages permission",
      color: COLORS.error,
      metadata: { ai: aiResult }
    })
    return
  }

  if (!member.moderatable) {
    await logAutomod({
      message,
      action: "automod_block",
      trigger,
      reason: `${trigger.reason} (member not moderatable)`,
      color: COLORS.error,
      metadata: { ai: aiResult }
    })
    return
  }

  await store.addInfraction({ guildId: guild.id, userId, triggerType: trigger.type, reason: trigger.reason, metadata: { ai: aiResult } })
  const points = await store.countInfractions(guild.id, userId, trigger.type, 1440)

  const ladder = cfg.punishments[trigger.type] || cfg.punishments.default
  const action = ladder[Math.min(points - 1, ladder.length - 1)]
  const reason = `[AutoMod:${trigger.type}] ${trigger.reason}`

  try {
    await message.delete()
  } catch {
    await logAutomod({
      message,
      action: "automod_delete_failed",
      trigger,
      reason: `${reason} (failed to delete message)`,
      color: COLORS.error,
      metadata: { ai: aiResult, points }
    })
    return
  }

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
      await logAutomod({
        message,
        action: "warn",
        trigger,
        reason,
        color: COLORS.warning,
        metadata: { ai: aiResult, points, warningId, warningCount: totalWarnings }
      })
    } catch (err) {
      await logAutomod({
        message,
        action: "warn_failed",
        trigger,
        reason: `${reason} (persist failed)`,
        color: COLORS.error,
        metadata: { ai: aiResult, points, error: err?.message }
      })
    }
  }

  if (action === "mute") {
    const duration = points > 2 ? cfg.timeouts.longMuteMs : cfg.timeouts.muteMs
    if (!botMember.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      await logAutomod({
        message,
        action: "automod_permission_error",
        trigger,
        reason: `${reason} (missing ModerateMembers permission)`,
        color: COLORS.error,
        metadata: { ai: aiResult, points }
      })
      return
    }

    try {
      await member.timeout(duration, reason)
      await logAutomod({
        message,
        action: "timeout",
        trigger,
        reason,
        color: COLORS.warning,
        metadata: { ai: aiResult, points, duration: `${Math.round(duration / 60000)}m` }
      })
    } catch (err) {
      await logAutomod({
        message,
        action: "timeout_failed",
        trigger,
        reason: `${reason} (failed to timeout member)`,
        color: COLORS.error,
        metadata: { ai: aiResult, points, error: err?.message }
      })
    }
  }

  if (action === "kick") {
    if (!botMember.permissions.has(PermissionsBitField.Flags.KickMembers) || !member.kickable) {
      await logAutomod({
        message,
        action: "automod_permission_error",
        trigger,
        reason: `${reason} (cannot kick member)`,
        color: COLORS.error,
        metadata: { ai: aiResult, points }
      })
      return
    }

    try {
      await member.kick(reason)
      await logAutomod({
        message,
        action: "kick",
        trigger,
        reason,
        color: COLORS.error,
        metadata: { ai: aiResult, points }
      })
    } catch (err) {
      await logAutomod({
        message,
        action: "kick_failed",
        trigger,
        reason: `${reason} (failed to kick member)`,
        color: COLORS.error,
        metadata: { ai: aiResult, points, error: err?.message }
      })
    }
  }

  if (action === "ban") {
    if (!botMember.permissions.has(PermissionsBitField.Flags.BanMembers) || !member.bannable) {
      await logAutomod({
        message,
        action: "automod_permission_error",
        trigger,
        reason: `${reason} (cannot ban member)`,
        color: COLORS.error,
        metadata: { ai: aiResult, points }
      })
      return
    }

    try {
      await member.ban({ reason, deleteMessageSeconds: 60 * 60 })
      await logAutomod({
        message,
        action: "ban",
        trigger,
        reason,
        color: COLORS.error,
        metadata: { ai: aiResult, points }
      })
    } catch (err) {
      await logAutomod({
        message,
        action: "ban_failed",
        trigger,
        reason: `${reason} (failed to ban member)`,
        color: COLORS.error,
        metadata: { ai: aiResult, points, error: err?.message }
      })
    }
  }

  await store.setPunishmentCooldown(guild.id, userId, trigger.type, cfg.rateLimit.cooldownMs)
}

module.exports.handleMessage = async message => {
  try {
    if (!message?.guild || message.author?.bot) return { blocked: false }

    const cfg = await store.getConfig(message.guild.id)
    if (!cfg.enabled || hasBypass(message.member, cfg)) return { blocked: false }

    const patterns = buildPatterns(cfg)
    const checks = []

    if (cfg.checks.blacklist && containsBlacklist(message.content || "", patterns)) {
      checks.push({ type: "blacklist", rule: "blacklist", reason: "Blacklisted word/pattern detected" })
    }

    if (cfg.checks.links || cfg.checks.invites) {
      const link = evaluateLinks(message.content || "", cfg)
      if (link) checks.push(link)
    }

    if (cfg.checks.spam || cfg.checks.rateLimit || cfg.checks.mentions) {
      const spam = evaluateSpam(message, cfg)
      if (spam) checks.push(spam)
    }

    if (cfg.checks.caps) {
      const caps = evaluateCaps(message.content || "", cfg)
      if (caps) checks.push(caps)
    }

    if (cfg.checks.attachments && message.attachments.size > 0) {
      for (const attachment of message.attachments.values()) {
        if (!attachment.contentType?.startsWith("image/")) continue
        checks.push({ type: "explicit_attachment", rule: "attachment_image", reason: "Image attachment requires moderation", imageUrl: attachment.url })
      }
    }

    if (!checks.length) return { blocked: false }

    const candidate = checks[0]
    const aiResult = cfg.checks.aiModeration
      ? await moderateContent({ text: message.content, imageUrl: candidate.imageUrl, category: candidate.type })
      : { skipped: true, reason: "AI moderation disabled" }

    if (cfg.checks.aiModeration && !aiResult.skipped && !aiResult.flagged) {
      await logAutomod({
        message,
        action: "automod_review",
        trigger: candidate,
        reason: `Trigger matched but AI moderation did not flag: ${candidate.reason}`,
        color: COLORS.info,
        metadata: { ai: aiResult }
      })
      return { blocked: false }
    }

    await applyPunishment({ message, cfg, trigger: candidate, aiResult })
    return { blocked: true, reason: candidate.reason }
  } catch (err) {
    if (message?.guild) {
      await logModerationAction({
        guild: message.guild,
        action: "automod_internal_error",
        userId: message.author?.id,
        moderatorId: message.guild.members.me?.id,
        reason: "Unhandled AutoMod exception",
        color: COLORS.error,
        metadata: {
          error: err?.message,
          automod: {
            channelId: message.channel?.id || null,
            messageId: message.id,
            messagePreview: safePreview(message.content),
            userId: message.author?.id
          }
        }
      })
    }

    return { blocked: false }
  }
}
