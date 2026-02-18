const { PermissionsBitField } = require("discord.js")
const logModerationAction = require("../../utils/logModerationAction")
const COLORS = require("../../utils/colors")
const { extract } = require("../../utils/linkScanner")
const { normalizeText } = require("./normalizer")
const { escapeMarkdownSafe } = require("../../utils/safeText")
const store = require("./store")

const SAFE_DOMAINS = new Set([
  "youtube.com",
  "youtu.be",
  "twitter.com",
  "x.com",
  "github.com",
  "discord.com",
  "discord.gg",
  "discordapp.com",
  "discordapp.net",
  "discordcdn.com"
])

const INVITE_RE = /(discord\.gg\/[\w-]+|discord\.com\/invite\/[\w-]+)/i
const COMMAND_PREFIX_FALLBACK = "!"
const BUCKET_RETENTION_MS = 2 * 60 * 1000
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000

const messageBuckets = new Map()

const getBucket = (guildId, userId) => {
  const key = `${guildId}:${userId}`
  if (!messageBuckets.has(key)) messageBuckets.set(key, [])
  return messageBuckets.get(key)
}

const compactBucket = (bucket, maxWindowMs) => {
  const now = Date.now()
  while (bucket.length && now - bucket[0].ts > maxWindowMs) bucket.shift()
}

setInterval(() => {
  const now = Date.now()
  for (const [key, bucket] of messageBuckets.entries()) {
    compactBucket(bucket, BUCKET_RETENTION_MS)
    if (!bucket.length || now - bucket[bucket.length - 1].ts > BUCKET_RETENTION_MS) {
      messageBuckets.delete(key)
    }
  }
}, CLEANUP_INTERVAL_MS).unref()

const safePreview = content => {
  const normalized = String(content || "").replace(/\s+/g, " ").trim()
  if (!normalized) return "[no text content]"
  const escaped = escapeMarkdownSafe(normalized)
  return escaped.length > 220 ? `${escaped.slice(0, 217)}...` : escaped
}

const normalizeHost = host => String(host || "").toLowerCase().replace(/^www\./, "")

const getRootDomain = host => {
  const normalizedHost = normalizeHost(host)
  const parts = normalizedHost.split(".")
  if (parts.length <= 2) return normalizedHost
  return parts.slice(-2).join(".")
}

const matchesDomainSet = (host, domainSet) => {
  const normalized = normalizeHost(host)
  const root = getRootDomain(normalized)
  return domainSet.has(normalized) || domainSet.has(root)
}

const parseHostFromUrl = url => {
  try {
    return normalizeHost(new URL(url.startsWith("http") ? url : `https://${url}`).hostname)
  } catch {
    return ""
  }
}

const hasBypass = (message, cfg) => {
  const member = message.member
  if (!member) return true

  if (message.client?.application?.owner?.id && message.author.id === message.client.application.owner.id) return true
  if (cfg.whitelistedUsers?.includes(message.author.id)) return true
  if (member.permissions.has(PermissionsBitField.Flags.Administrator)) return true
  if (cfg.allowStaffBypass && member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return true
  if (cfg.trustedRoles?.length && member.roles.cache.hasAny(...cfg.trustedRoles)) return true

  return false
}

const isIgnoredMessageContext = (message, cfg) => {
  if (cfg.ignoredUsers?.includes(message.author.id)) return true
  if (cfg.ignoredChannels?.includes(message.channel.id)) return true

  const categoryId = message.channel?.parentId
  if (categoryId && cfg.ignoredCategories?.includes(categoryId)) return true

  if (message.webhookId && !cfg.allowWebhookMessages) return true

  return false
}

const toDetectorResult = ({ score, triggerType, reason, metadata = {}, timeoutMs }) => ({
  score,
  triggerType,
  reason,
  timeoutMs,
  metadata
})

const detectBannedWords = (content, cfg) => {
  const rule = cfg.rules.bannedWords
  if (!rule.enabled) return null

  const normalized = normalizeText(content)
  for (const word of rule.words) {
    const pattern = normalizeText(word)
    if (!pattern) continue
    if (normalized.includes(pattern)) {
      return toDetectorResult({
        score: rule.score ?? 10,
        triggerType: "bannedWords",
        reason: `Contains banned phrase: ${pattern}`,
        timeoutMs: rule.timeoutMs,
        metadata: { phrase: pattern }
      })
    }
  }

  return null
}

const detectLinks = (content, cfg) => {
  const rule = cfg.rules.links
  if (!rule.enabled) return null

  const urls = extract(content)
  if (!urls.length) return null

  const mode = rule.mode || "block_invites_only"
  const whitelist = new Set((rule.whitelistedDomains || []).map(normalizeHost))
  const blocked = new Set((rule.blockedDomains || []).map(normalizeHost))
  const shorteners = new Set((rule.shortenerDomains || []).map(normalizeHost))

  let score = 0
  const reasons = []
  const matchedHosts = new Set()

  for (const rawUrl of urls) {
    const host = parseHostFromUrl(rawUrl)
    if (!host) continue

    const root = getRootDomain(host)
    const isSafeDomain = SAFE_DOMAINS.has(host) || SAFE_DOMAINS.has(root)
    const isWhitelisted = matchesDomainSet(host, whitelist)
    const isInvite = INVITE_RE.test(rawUrl)

    if (isSafeDomain || isWhitelisted) continue

    if (mode === "block_invites_only") {
      if (isInvite) {
        score += rule.scoreInvite ?? 6
        matchedHosts.add(host)
        reasons.push("Discord invite detected")
      }
      continue
    }

    if (mode === "block_shortened_urls") {
      if (matchesDomainSet(host, shorteners)) {
        score += rule.scoreShortener ?? 5
        matchedHosts.add(host)
        reasons.push(`Shortened URL domain: ${host}`)
      }
      continue
    }

    if (mode === "allow_whitelist_only") {
      score += rule.scoreBlockedDomain ?? 8
      matchedHosts.add(host)
      reasons.push(`Domain not in whitelist: ${host}`)
      continue
    }

    if (matchesDomainSet(host, blocked)) {
      score += rule.scoreBlockedDomain ?? 8
      matchedHosts.add(host)
      reasons.push(`Blocked domain: ${host}`)
    }
  }

  if (!score) return null

  return toDetectorResult({
    score,
    triggerType: "links",
    reason: reasons.join("; "),
    timeoutMs: rule.timeoutMs,
    metadata: { hosts: [...matchedHosts], mode }
  })
}

const detectMentionSpam = (message, cfg) => {
  const rule = cfg.rules.mentionSpam
  if (!rule.enabled) return null

  const mentionCount = message.mentions.users.size + message.mentions.roles.size
  if (mentionCount <= rule.maxMentions) return null

  return toDetectorResult({
    score: rule.score ?? 6,
    triggerType: "mentionSpam",
    reason: `Too many mentions (${mentionCount}/${rule.maxMentions})`,
    timeoutMs: rule.timeoutMs,
    metadata: { mentionCount }
  })
}

const normalizeMessageForSimilarity = content =>
  normalizeText(content)
    .replace(/https?:\/\/\S+/g, "")
    .replace(/<a?:\w+:\d+>/g, "")
    .replace(/<@!?\d+>/g, "")
    .replace(/\s+/g, " ")
    .trim()

const calculateSimilarityRatio = messages => {
  const comparable = messages.map(normalizeMessageForSimilarity).filter(text => text.length >= 5)
  if (comparable.length < 2) return 0

  const frequencies = comparable.reduce((map, text) => {
    map.set(text, (map.get(text) || 0) + 1)
    return map
  }, new Map())

  const maxOccurrence = Math.max(...frequencies.values())
  return maxOccurrence / comparable.length
}

const isCommandMessage = message => {
  const content = String(message.content || "").trim()
  if (!content) return false

  const prefix = message.client?.config?.prefix || COMMAND_PREFIX_FALLBACK
  return content.startsWith(prefix)
}

const detectMessageSpam = (message, cfg) => {
  const rule = cfg.rules.messageSpam
  if (!rule.enabled) return null

  if (isCommandMessage(message)) return null
  if (!String(message.content || "").trim() && (message.attachments.size || message.embeds.length)) return null

  const now = Date.now()
  const bucket = getBucket(message.guild.id, message.author.id)
  const normalized = normalizeMessageForSimilarity(message.content || "")

  bucket.push({ ts: now, text: normalized, len: normalized.length })
  compactBucket(bucket, Math.max(rule.windowMs, rule.duplicateWindowMs, BUCKET_RETENTION_MS))

  const windowMessages = bucket.filter(item => now - item.ts <= rule.windowMs)
  if (windowMessages.length < (rule.minMessagesForEvaluation ?? 3)) return null

  const rateExceeded = windowMessages.length > rule.maxMessages
  const avgLength = windowMessages.reduce((sum, item) => sum + item.len, 0) / windowMessages.length
  const similarity = calculateSimilarityRatio(windowMessages.map(item => item.text))
  const highSimilarity = similarity >= (rule.similarityThreshold ?? 0.7)

  if (!rateExceeded || !highSimilarity) return null

  let score = 0
  const reasons = []

  score += 4
  reasons.push(`Rate exceeded (${windowMessages.length}/${rule.maxMessages})`)

  if (avgLength <= (rule.maxAverageLength ?? 20)) {
    if (similarity >= 0.9) {
      score += 6
      reasons.push(`Very high similarity (${Math.round(similarity * 100)}%)`)
    } else {
      score += 4
      reasons.push(`High similarity (${Math.round(similarity * 100)}%)`)
    }
  }

  if (!score) return null

  return toDetectorResult({
    score,
    triggerType: "messageSpam",
    reason: reasons.join("; "),
    timeoutMs: rule.timeoutMs,
    metadata: {
      messageCount: windowMessages.length,
      similarity,
      averageLength: avgLength
    }
  })
}

const stripCapsIgnoredSegments = content =>
  String(content || "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/<@!?\d+>|<#\d+>|<@&\d+>/g, "")

const detectCapsSpam = (content, cfg) => {
  const rule = cfg.rules.capsSpam
  if (!rule.enabled) return null

  const sanitized = stripCapsIgnoredSegments(content)
  const letters = sanitized.replace(/[^a-z]/gi, "")

  if (letters.length < rule.minLength) return null

  const uppercaseCount = letters.replace(/[^A-Z]/g, "").length
  const ratio = uppercaseCount / letters.length
  if (ratio < rule.maxUppercaseRatio) return null

  return toDetectorResult({
    score: rule.score ?? 4,
    triggerType: "capsSpam",
    reason: `Uppercase ratio too high (${Math.round(ratio * 100)}%)`,
    timeoutMs: rule.timeoutMs,
    metadata: { ratio }
  })
}

const resolveLogChannel = (guild, cfg) => {
  if (!cfg.logChannelId) return null
  return guild.channels.cache.get(cfg.logChannelId) || null
}

const logStructuredEvent = async ({ message, cfg, evaluation, actionTaken, error = null }) => {
  const payload = {
    guildId: message.guild.id,
    userId: message.author.id,
    messageId: message.id,
    violationScore: evaluation.violationScore,
    triggers: evaluation.triggers,
    actionTaken,
    timestamp: new Date().toISOString(),
    error: error ? String(error.message || error) : null
  }

  await logModerationAction({
    guild: message.guild,
    action: `automod_${actionTaken}`,
    userId: message.author.id,
    moderatorId: message.guild.members.me?.id,
    reason: evaluation.summary,
    color: actionTaken.includes("delete") ? COLORS.warning : COLORS.info,
    metadata: {
      automod: {
        ...payload,
        channelId: message.channel.id,
        messagePreview: safePreview(message.content)
      }
    }
  })

  const logChannel = resolveLogChannel(message.guild, cfg)
  if (!logChannel) return

  await logChannel.send({
    embeds: [
      {
        title: "AutoMod Evaluation",
        color: actionTaken.includes("delete") ? COLORS.warning : COLORS.info,
        fields: [
          { name: "User", value: `<@${message.author.id}>`, inline: true },
          { name: "Channel", value: `<#${message.channel.id}>`, inline: true },
          { name: "Score", value: String(evaluation.violationScore), inline: true },
          { name: "Action", value: actionTaken, inline: true },
          { name: "Triggers", value: evaluation.triggers.map(t => `${t.triggerType} (+${t.score})`).join("\n") || "None", inline: false },
          { name: "Summary", value: escapeMarkdownSafe(evaluation.summary), inline: false }
        ],
        timestamp: payload.timestamp
      }
    ]
  })
}

const evaluateNewUserSensitivity = message => {
  const accountAgeMs = Date.now() - message.author.createdTimestamp
  const joinedTimestamp = message.member?.joinedTimestamp || Date.now()
  const joinedAgeMs = Date.now() - joinedTimestamp

  let score = 0
  const reasons = []

  if (accountAgeMs < 3 * 24 * 60 * 60 * 1000) {
    score += 2
    reasons.push("Account age under 3 days")
  }

  if (joinedAgeMs < 24 * 60 * 60 * 1000) {
    score += 2
    reasons.push("Joined guild within 24 hours")
  }

  if (!score) return null

  return toDetectorResult({
    score,
    triggerType: "newUserSensitivity",
    reason: reasons.join("; "),
    metadata: {
      accountAgeHours: Math.floor(accountAgeMs / 3600000),
      joinedAgeHours: Math.floor(joinedAgeMs / 3600000)
    }
  })
}

const determineRecommendedAction = (score, cfg) => {
  const thresholds = cfg.scoreThresholds || {}
  const warnThreshold = thresholds.warn ?? 5
  const deleteThreshold = thresholds.delete ?? 10
  const timeoutThreshold = thresholds.timeout ?? 15

  if (score >= timeoutThreshold) return "delete_timeout"
  if (score >= deleteThreshold) return "delete"
  if (score >= warnThreshold) return "warn"
  return "ignore"
}

const createEvaluationResult = triggers => {
  const violationScore = triggers.reduce((sum, trigger) => sum + trigger.score, 0)
  const summary = triggers.map(trigger => `${trigger.triggerType}: ${trigger.reason}`).join(" | ") || "No violations"

  return {
    violationScore,
    triggers,
    summary
  }
}

const reportRiskSignal = async (message, evaluation, actionTaken) => {
  const engine = message.client?.riskEngine
  if (!engine || typeof engine.recordAutomodSignal !== "function") return

  const joinedTs = message.member?.joinedTimestamp || Date.now()
  const accountAgeDays = Math.max(0, Math.floor((Date.now() - message.author.createdTimestamp) / 86400000))
  const daysInGuild = Math.max(0, Math.floor((Date.now() - joinedTs) / 86400000))

  await engine.recordAutomodSignal({
    guildId: message.guild.id,
    userId: message.author.id,
    accountAgeDays,
    daysInGuild,
    occurredAt: new Date(message.createdTimestamp),
    signal: {
      type: "automod_score",
      severity: Math.min(5, Math.max(1, Math.ceil(evaluation.violationScore / 4))),
      metadata: {
        actionTaken,
        violationScore: evaluation.violationScore,
        triggers: evaluation.triggers.map(trigger => trigger.triggerType)
      }
    }
  })
}

const safeDeleteMessage = async message => {
  if (message.deleted) return true
  await message.delete()
  return true
}

const sendWarning = async message => {
  const warningMessage = "Your recent message triggered moderation risk checks. Please avoid repeated spam or suspicious links."
  await message.author.send({ content: warningMessage })
}

const applyAction = async ({ message, cfg, evaluation, recommendedAction }) => {
  const guild = message.guild
  const member = message.member
  const me = guild.members.me

  if (!member || !me) {
    await logStructuredEvent({ message, cfg, evaluation, actionTaken: "skipped_missing_member" })
    return { blocked: false, recommendedAction }
  }

  const cooldownKey = evaluation.triggers.map(trigger => trigger.triggerType).sort().join("+") || "none"
  const isCoolingDown = await store.isPunishmentCoolingDown(guild.id, message.author.id, cooldownKey)
  if (isCoolingDown) {
    await logStructuredEvent({ message, cfg, evaluation, actionTaken: "skipped_cooldown" })
    return { blocked: false, recommendedAction }
  }

  await store.setPunishmentCooldown(guild.id, message.author.id, cooldownKey, cfg.cooldownMs)

  if (recommendedAction === "ignore") {
    await logStructuredEvent({ message, cfg, evaluation, actionTaken: "log_only" })
    return { blocked: false, recommendedAction }
  }

  if (recommendedAction === "warn") {
    try {
      await sendWarning(message)
      await logStructuredEvent({ message, cfg, evaluation, actionTaken: "warn" })
    } catch (error) {
      await logStructuredEvent({ message, cfg, evaluation, actionTaken: "warn_failed", error })
    }
    return { blocked: false, recommendedAction }
  }

  if (!me.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
    await logStructuredEvent({ message, cfg, evaluation, actionTaken: "delete_permission_missing" })
    return { blocked: false, recommendedAction }
  }

  try {
    await safeDeleteMessage(message)
  } catch (error) {
    await logStructuredEvent({ message, cfg, evaluation, actionTaken: "delete_failed", error })
    return { blocked: false, recommendedAction }
  }

  await store.addInfraction({
    guildId: guild.id,
    userId: message.author.id,
    triggerType: cooldownKey,
    reason: evaluation.summary,
    metadata: {
      automod: {
        violationScore: evaluation.violationScore,
        triggers: evaluation.triggers,
        actionRequested: recommendedAction,
        messagePreview: safePreview(message.content),
        channelId: message.channel.id
      }
    }
  })

  if (recommendedAction !== "delete_timeout") {
    await logStructuredEvent({ message, cfg, evaluation, actionTaken: "delete" })
    return { blocked: true, recommendedAction }
  }

  if (!me.permissions.has(PermissionsBitField.Flags.ModerateMembers) || !member.moderatable) {
    await logStructuredEvent({ message, cfg, evaluation, actionTaken: "delete_only_timeout_permission_missing" })
    return { blocked: true, recommendedAction: "delete" }
  }

  const timeoutMs = Math.max(...evaluation.triggers.map(trigger => trigger.timeoutMs || 0), 10 * 60 * 1000)

  try {
    await member.timeout(timeoutMs, `[AutoMod] Score ${evaluation.violationScore}: ${evaluation.summary}`)
    await logStructuredEvent({ message, cfg, evaluation, actionTaken: `delete_timeout (${Math.floor(timeoutMs / 60000)}m)` })
  } catch (error) {
    await logStructuredEvent({ message, cfg, evaluation, actionTaken: "delete_only_timeout_failed", error })
    return { blocked: true, recommendedAction: "delete" }
  }

  return { blocked: true, recommendedAction }
}

const evaluateMessage = (message, cfg) => {
  const triggers = [
    detectBannedWords(message.content || "", cfg),
    detectLinks(message.content || "", cfg),
    detectMentionSpam(message, cfg),
    detectMessageSpam(message, cfg),
    detectCapsSpam(message.content || "", cfg),
    evaluateNewUserSensitivity(message)
  ].filter(Boolean)

  const evaluation = createEvaluationResult(triggers)
  const recommendedAction = determineRecommendedAction(evaluation.violationScore, cfg)

  return {
    ...evaluation,
    recommendedAction
  }
}

module.exports.evaluate = evaluateMessage

module.exports.handleMessage = async message => {
  if (!message?.guild || message.author?.bot) return { blocked: false }

  const cfg = await store.getConfig(message.guild.id)
  if (!cfg.enabled) return { blocked: false }

  if (isIgnoredMessageContext(message, cfg)) return { blocked: false }
  if (hasBypass(message, cfg)) return { blocked: false }

  const evaluation = evaluateMessage(message, cfg)

  try {
    const actionResult = await applyAction({
      message,
      cfg,
      evaluation,
      recommendedAction: evaluation.recommendedAction
    })

    await reportRiskSignal(message, evaluation, actionResult.recommendedAction)

    return {
      blocked: Boolean(actionResult.blocked),
      violationScore: evaluation.violationScore,
      triggers: evaluation.triggers,
      recommendedAction: actionResult.recommendedAction
    }
  } catch (error) {
    await logStructuredEvent({
      message,
      cfg,
      evaluation,
      actionTaken: "evaluation_failed",
      error
    })

    return {
      blocked: false,
      violationScore: evaluation.violationScore,
      triggers: evaluation.triggers,
      recommendedAction: "ignore"
    }
  }
}
