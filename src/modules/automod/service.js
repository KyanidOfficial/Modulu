const { PermissionsBitField } = require("discord.js")
const { extract } = require("../../shared/utils/linkScanner")
const { normalizeText } = require("./normalizer")
const store = require("./store")
const logModerationAction = require("../../shared/utils/logModerationAction")
const COLORS = require("../../shared/utils/colors")

const COMMAND_PREFIX_FALLBACK = "!"
const TRACKING_RETENTION_MS = 5 * 60 * 1000
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000
const INVITE_RE = /(discord\.gg\/[\w-]+|discord(?:app)?\.com\/invite\/[\w-]+)/i
const MULTI_PART_TLDS = new Set([
  "co.uk",
  "org.uk",
  "gov.uk",
  "ac.uk",
  "co.jp",
  "com.au",
  "net.au",
  "org.au",
  "co.nz"
])

const userMessageWindows = new Map()

const ensureWindow = (guildId, userId) => {
  const key = `${guildId}:${userId}`
  const existing = userMessageWindows.get(key)
  if (existing) return existing

  const created = []
  userMessageWindows.set(key, created)
  return created
}

const pruneWindow = (window, maxAgeMs) => {
  const now = Date.now()
  while (window.length && now - window[0].ts > maxAgeMs) {
    window.shift()
  }
}

setInterval(() => {
  const now = Date.now()
  for (const [key, window] of userMessageWindows.entries()) {
    pruneWindow(window, TRACKING_RETENTION_MS)
    if (!window.length || now - window[window.length - 1].ts > TRACKING_RETENTION_MS) {
      userMessageWindows.delete(key)
    }
  }
}, CLEANUP_INTERVAL_MS).unref()

const normalizeHost = rawHost => String(rawHost || "").toLowerCase().trim().replace(/^www\./, "")

const getRootDomain = host => {
  const normalized = normalizeHost(host)
  if (!normalized) return ""

  const parts = normalized.split(".").filter(Boolean)
  if (parts.length <= 2) return normalized

  const lastTwo = parts.slice(-2).join(".")
  if (MULTI_PART_TLDS.has(lastTwo) && parts.length >= 3) {
    return parts.slice(-3).join(".")
  }

  return lastTwo
}

const isDomainMatch = (host, domain) => {
  const normalizedHost = normalizeHost(host)
  const normalizedDomain = normalizeHost(domain)

  if (!normalizedHost || !normalizedDomain) return false
  return normalizedHost === normalizedDomain || normalizedHost.endsWith(`.${normalizedDomain}`)
}

const isInDomainList = (host, domains) => {
  if (!host || !domains?.length) return false

  const normalizedHost = normalizeHost(host)
  const root = getRootDomain(normalizedHost)
  return domains.some(domain => isDomainMatch(normalizedHost, domain) || isDomainMatch(root, domain))
}

const parseHostFromUrl = rawUrl => {
  if (!rawUrl) return ""

  try {
    const parsed = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`)
    return normalizeHost(parsed.hostname)
  } catch {
    return ""
  }
}

const containsKnownScamKeyword = (content, keywords = []) => {
  const normalized = normalizeText(content)
  return keywords.some(keyword => {
    const probe = normalizeText(keyword)
    return probe && normalized.includes(probe)
  })
}

const createResult = ({ score, type, reason, timeoutMs = 0, metadata = {}, enforcedAction = null }) => ({
  score,
  type,
  reason,
  timeoutMs,
  metadata,
  enforcedAction
})

const hasBypass = (message, cfg) => {
  const member = message.member
  if (!member) return true

  if (cfg.whitelistedUsers?.includes(message.author.id)) return true
  if (member.permissions.has(PermissionsBitField.Flags.Administrator)) return true
  if (cfg.allowStaffBypass && member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return true
  if (cfg.trustedRoles?.length && member.roles.cache.hasAny(...cfg.trustedRoles)) return true

  return false
}

const isIgnoredContext = (message, cfg) => {
  if (cfg.ignoredUsers?.includes(message.author.id)) return true
  if (cfg.ignoredChannels?.includes(message.channel.id)) return true
  if (message.channel?.parentId && cfg.ignoredCategories?.includes(message.channel.parentId)) return true
  if (message.webhookId && !cfg.allowWebhookMessages) return true
  return false
}

const isCommandMessage = message => {
  const content = String(message.content || "").trim()
  if (!content) return false

  const prefix = message.client?.config?.prefix || COMMAND_PREFIX_FALLBACK
  return content.startsWith(prefix)
}

const isAttachmentsOnly = message => {
  const text = String(message.content || "").trim()
  return !text && message.attachments.size > 0
}

const normalizeComparableMessage = content =>
  normalizeText(content)
    .replace(/https?:\/\/\S+/g, "")
    .replace(/<a?:\w+:\d+>/g, "")
    .replace(/<@!?\d+>|<#\d+>|<@&\d+>/g, "")
    .replace(/\s+/g, " ")
    .trim()

const similarityRatio = values => {
  if (values.length < 2) return 0

  const frequency = new Map()
  for (const value of values) {
    frequency.set(value, (frequency.get(value) || 0) + 1)
  }

  const maxOccurrence = Math.max(...frequency.values())
  return maxOccurrence / values.length
}

const detectBannedWords = (message, cfg) => {
  const rule = cfg.rules.bannedWords
  if (!rule?.enabled) return null

  const normalized = normalizeText(message.content || "")
  for (const word of rule.words || []) {
    const probe = normalizeText(word)
    if (!probe) continue

    if (normalized.includes(probe)) {
      return createResult({
        score: rule.score ?? 10,
        type: "banned_words",
        reason: `Contains banned phrase: ${probe}`,
        timeoutMs: rule.timeoutMs ?? 0,
        metadata: { phrase: probe }
      })
    }
  }

  return null
}

const detectLinks = (message, cfg) => {
  const rule = cfg.rules.links
  if (!rule?.enabled) return null

  const urls = extract(message.content || "")
  if (!urls.length) return null

  const blockedDomains = (rule.blockedDomains || []).map(normalizeHost)
  const whitelistedDomains = (rule.whitelistedDomains || []).map(normalizeHost)
  const shortenerDomains = (rule.shortenerDomains || []).map(normalizeHost)
  const redirectorDomains = (rule.redirectorDomains || []).map(normalizeHost)
  const scamKeywords = rule.knownScamKeywords || []
  const hasScamKeyword = containsKnownScamKeyword(message.content || "", scamKeywords)

  for (const rawUrl of urls) {
    const host = parseHostFromUrl(rawUrl)
    if (!host) continue

    if (isInDomainList(host, whitelistedDomains)) {
      continue
    }

    if (isInDomainList(host, blockedDomains)) {
      return createResult({
        score: rule.scoreBlockedDomain ?? 10,
        type: "links",
        reason: `Blocked domain: ${host}`,
        timeoutMs: rule.timeoutMs ?? 0,
        enforcedAction: "delete",
        metadata: { host, reasonType: "blocked_domain" }
      })
    }

    if (INVITE_RE.test(rawUrl) && rule.allowDiscordInvites === false) {
      return createResult({
        score: rule.scoreInvite ?? 10,
        type: "links",
        reason: `Discord invite blocked: ${host}`,
        timeoutMs: rule.timeoutMs ?? 0,
        enforcedAction: "delete",
        metadata: { host, reasonType: "discord_invite" }
      })
    }

    if (rule.blockRedirectors === true && (isInDomainList(host, shortenerDomains) || isInDomainList(host, redirectorDomains))) {
      return createResult({
        score: rule.scoreRedirector ?? 8,
        type: "links",
        reason: `Redirector/shortener blocked: ${host}`,
        timeoutMs: rule.timeoutMs ?? 0,
        metadata: { host, reasonType: "redirector" }
      })
    }

    if (hasScamKeyword) {
      return createResult({
        score: rule.scoreScamKeyword ?? 9,
        type: "links",
        reason: `Scam keyword with link detected: ${host}`,
        timeoutMs: rule.timeoutMs ?? 0,
        metadata: { host, reasonType: "scam_keyword" }
      })
    }
  }

  return null
}

const detectMentionSpam = (message, cfg) => {
  const rule = cfg.rules.mentionSpam
  if (!rule?.enabled) return null

  const mentionCount = message.mentions.users.size + message.mentions.roles.size
  const maxMentions = rule.maxMentions ?? 5
  if (mentionCount <= maxMentions) return null

  return createResult({
    score: rule.score ?? 10,
    type: "mention_spam",
    reason: `Too many mentions (${mentionCount}/${maxMentions})`,
    timeoutMs: rule.timeoutMs ?? 0,
    metadata: { mentionCount }
  })
}

const detectMessageSpam = (message, cfg) => {
  const rule = cfg.rules.messageSpam
  if (!rule?.enabled) return null

  if (isCommandMessage(message)) return null
  if (isAttachmentsOnly(message)) return null

  const comparable = normalizeComparableMessage(message.content || "")
  const minLength = rule.minMessageLength ?? 5
  if (comparable.length < minLength) return null

  const now = Date.now()
  const window = ensureWindow(message.guild.id, message.author.id)
  window.push({
    ts: now,
    text: comparable,
    mentionCount: message.mentions.users.size + message.mentions.roles.size
  })

  const windowMs = rule.windowMs ?? 15000
  const duplicateWindowMs = rule.duplicateWindowMs ?? 15000
  const retentionMs = Math.max(windowMs, duplicateWindowMs, TRACKING_RETENTION_MS)
  pruneWindow(window, retentionMs)

  const scoped = window.filter(entry => now - entry.ts <= windowMs)
  const duplicateScoped = window.filter(entry => now - entry.ts <= duplicateWindowMs)

  const duplicateCounts = new Map()
  for (const entry of duplicateScoped) {
    duplicateCounts.set(entry.text, (duplicateCounts.get(entry.text) || 0) + 1)
  }
  const maxDuplicates = duplicateCounts.size ? Math.max(...duplicateCounts.values()) : 0

  const repeatTimeoutCount = rule.repeatTimeoutCount ?? 6
  const maxMessages = rule.maxMessages ?? 10
  const rateExceeded = scoped.length >= maxMessages || maxDuplicates >= repeatTimeoutCount
  if (!rateExceeded) return null

  const comparableTexts = scoped.map(entry => entry.text).filter(text => text.length >= minLength)
  if (comparableTexts.length < (rule.minMessagesForEvaluation ?? 3)) return null

  const similarity = similarityRatio(comparableTexts)
  const similarityThreshold = rule.similarityThreshold ?? 0.7
  const similarityExceeded = similarity >= similarityThreshold
  if (!similarityExceeded) return null

  const duplicateExceeded = maxDuplicates >= (rule.maxDuplicates ?? 4)
  const severeDuplicateSpam = maxDuplicates >= repeatTimeoutCount

  const score =
    (rule.scoreRate ?? 5) +
    (rule.scoreSimilarity ?? 5) +
    (duplicateExceeded ? (rule.scoreDuplicate ?? 2) : 0) +
    (severeDuplicateSpam ? (rule.scoreSevereDuplicate ?? 5) : 0)

  return createResult({
    score,
    type: "message_spam",
    reason: `Rate exceeded (${scoped.length}/${maxMessages}) and similarity high (${similarity.toFixed(2)}/${similarityThreshold})`,
    timeoutMs: rule.timeoutMs ?? 0,
    enforcedAction: severeDuplicateSpam ? "delete_timeout" : null,
    metadata: {
      messageCount: scoped.length,
      maxMessages,
      similarity,
      similarityThreshold,
      maxDuplicates,
      duplicateExceeded,
      severeDuplicateSpam,
      rateExceeded
    }
  })
}

const stripCapsIgnoredSegments = content =>
  String(content || "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/<@!?\d+>|<#\d+>|<@&\d+>/g, "")

const detectCapsSpam = (message, cfg) => {
  const rule = cfg.rules.capsSpam
  if (!rule?.enabled) return null

  const sanitized = stripCapsIgnoredSegments(message.content || "")
  const lettersOnly = sanitized.replace(/[^a-z]/gi, "")
  const minLength = rule.minLength ?? 20
  if (lettersOnly.length < minLength) return null

  const uppercaseCount = lettersOnly.replace(/[^A-Z]/g, "").length
  const uppercaseRatio = uppercaseCount / lettersOnly.length
  const threshold = rule.maxUppercaseRatio ?? 0.75
  if (uppercaseRatio <= threshold) return null

  return createResult({
    score: rule.score ?? 4,
    type: "caps_spam",
    reason: `Uppercase ratio high (${uppercaseRatio.toFixed(2)}/${threshold})`,
    timeoutMs: rule.timeoutMs ?? 0,
    metadata: { uppercaseRatio }
  })
}

const determineActionFromThresholds = (score, cfg) => {
  const thresholds = cfg.scoreThresholds || {}
  const warnThreshold = thresholds.warn ?? 5
  const deleteThreshold = thresholds.delete ?? 10
  const timeoutThreshold = thresholds.timeout ?? 15

  if (score >= timeoutThreshold) return "delete_timeout"
  if (score >= deleteThreshold) return "delete"
  if (score >= warnThreshold) return "warn"
  return "ignore"
}

const actionPriority = {
  ignore: 0,
  warn: 1,
  delete: 2,
  delete_timeout: 3
}

const strongerAction = (left, right) =>
  (actionPriority[right] || 0) > (actionPriority[left] || 0) ? right : left

const evaluateMessage = (message, cfg) => {
  const detectors = [
    detectBannedWords(message, cfg),
    detectLinks(message, cfg),
    detectMentionSpam(message, cfg),
    detectMessageSpam(message, cfg),
    detectCapsSpam(message, cfg)
  ].filter(Boolean)

  const score = detectors.reduce((sum, result) => sum + result.score, 0)
  const thresholdAction = determineActionFromThresholds(score, cfg)
  const detectorAction = detectors.reduce(
    (selected, detector) => strongerAction(selected, detector.enforcedAction || "ignore"),
    "ignore"
  )

  return {
    score,
    action: strongerAction(thresholdAction, detectorAction),
    detectors,
    summary: detectors.map(detector => `${detector.type}: ${detector.reason}`).join(" | ") || "No violations"
  }
}

const canDeleteMessage = guild =>
  Boolean(guild?.members?.me?.permissions?.has(PermissionsBitField.Flags.ManageMessages))

const canTimeoutMember = (guild, member) =>
  Boolean(
    guild?.members?.me?.permissions?.has(PermissionsBitField.Flags.ModerateMembers) &&
    member?.moderatable
  )

const safeDelete = async message => {
  if (!message || message.deleted) return false
  try {
    await message.delete()
    return true
  } catch {
    return false
  }
}

const safeWarn = async message => {
  try {
    await message.author.send({
      content: "Your recent message triggered AutoMod. Please review server rules before sending similar content again."
    })
    return true
  } catch {
    return false
  }
}

const safeTimeout = async (member, ms, reason) => {
  try {
    await member.timeout(ms, reason)
    return true
  } catch {
    return false
  }
}

const logAction = async ({ message, evaluation, action }) => {
  try {
    await logModerationAction({
      guild: message.guild,
      action: `automod_${action}`,
      userId: message.author.id,
      moderatorId: message.guild.members.me?.id,
      reason: evaluation.summary,
      color: action.includes("delete") ? COLORS.warning : COLORS.info,
      metadata: {
        automod: {
          guildId: message.guild.id,
          channelId: message.channel.id,
          userId: message.author.id,
          messageId: message.id,
          score: evaluation.score,
          detectors: evaluation.detectors,
          action
        }
      }
    })
  } catch {
    // no-op
  }
}

const persistInfraction = async (message, evaluation, action) => {
  try {
    await store.addInfraction({
      guildId: message.guild.id,
      userId: message.author.id,
      triggerType: evaluation.detectors.map(detector => detector.type).join("+") || "none",
      reason: evaluation.summary,
      metadata: {
        automod: {
          score: evaluation.score,
          action,
          channelId: message.channel.id,
          messageId: message.id,
          detectors: evaluation.detectors
        }
      }
    })
  } catch {
    // no-op
  }
}

const applyAction = async (message, evaluation) => {
  if (evaluation.action === "ignore") return { blocked: false, action: "ignore" }

  if (evaluation.action === "warn") {
    const warned = await safeWarn(message)
    if (warned) {
      await persistInfraction(message, evaluation, "warn")
      await logAction({ message, evaluation, action: "warn" })
    }
    return { blocked: false, action: warned ? "warn" : "ignore" }
  }

  if (!canDeleteMessage(message.guild)) {
    return { blocked: false, action: "ignore" }
  }

  const deleted = await safeDelete(message)
  if (!deleted) return { blocked: false, action: "ignore" }

  await persistInfraction(message, evaluation, "delete")

  if (evaluation.action !== "delete_timeout") {
    await logAction({ message, evaluation, action: "delete" })
    return { blocked: true, action: "delete" }
  }

  const timeoutMs = Math.max(60_000, ...evaluation.detectors.map(detector => detector.timeoutMs || 0))
  if (!canTimeoutMember(message.guild, message.member)) {
    await logAction({ message, evaluation, action: "delete" })
    return { blocked: true, action: "delete" }
  }

  const timedOut = await safeTimeout(
    message.member,
    timeoutMs,
    `[AutoMod] Score ${evaluation.score}: ${evaluation.summary}`
  )

  if (timedOut) {
    await logAction({ message, evaluation, action: "delete_timeout" })
    return { blocked: true, action: "delete_timeout" }
  }

  await logAction({ message, evaluation, action: "delete" })
  return { blocked: true, action: "delete" }
}

module.exports.evaluate = evaluateMessage

module.exports.handleMessage = async message => {
  if (!message?.guild || message.author?.bot) return { blocked: false, action: "ignore" }

  let cfg
  try {
    cfg = await store.getConfig(message.guild.id)
  } catch {
    return { blocked: false, action: "ignore" }
  }

  if (!cfg?.enabled) return { blocked: false, action: "ignore" }
  if (isIgnoredContext(message, cfg)) return { blocked: false, action: "ignore" }
  if (hasBypass(message, cfg)) return { blocked: false, action: "ignore" }

  const evaluation = evaluateMessage(message, cfg)

  try {
    const result = await applyAction(message, evaluation)
    return {
      blocked: result.blocked,
      action: result.action,
      score: evaluation.score,
      detectors: evaluation.detectors
    }
  } catch {
    return {
      blocked: false,
      action: "ignore",
      score: evaluation.score,
      detectors: evaluation.detectors
    }
  }
}
