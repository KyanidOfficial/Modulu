const { PermissionsBitField } = require("discord.js")
const logModerationAction = require("../../utils/logModerationAction")
const COLORS = require("../../utils/colors")
const { extract } = require("../../utils/linkScanner")
const { normalizeText } = require("./normalizer")
const { escapeMarkdownSafe } = require("../../utils/safeText")
const store = require("./store")

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

const safePreview = content => {
  const normalized = String(content || "").replace(/\s+/g, " ").trim()
  if (!normalized) return "[no text content]"
  const escaped = escapeMarkdownSafe(normalized)
  return escaped.length > 220 ? `${escaped.slice(0, 217)}...` : escaped
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

const detectBannedWords = (content, cfg) => {
  if (!cfg.rules.bannedWords.enabled) return null
  const normalized = normalizeText(content)
  for (const word of cfg.rules.bannedWords.words) {
    const pattern = normalizeText(word)
    if (!pattern) continue
    if (normalized.includes(pattern)) {
      return {
        type: "bannedWords",
        ruleName: "Banned Words",
        reason: `Contains banned phrase: ${pattern}`,
        action: cfg.rules.bannedWords.action,
        timeoutMs: cfg.rules.bannedWords.timeoutMs
      }
    }
  }
  return null
}

const detectLinks = (content, cfg) => {
  if (!cfg.rules.links.enabled) return null
  const urls = extract(content)
  const lowered = normalizeText(content)

  if (!cfg.rules.links.allowDiscordInvites && /(discord\.gg|discord\.com\/invite)/i.test(lowered)) {
    return {
      type: "links",
      ruleName: "Link Filter",
      reason: "Discord invite links are blocked",
      action: cfg.rules.links.action,
      timeoutMs: cfg.rules.links.timeoutMs
    }
  }

  for (const url of urls) {
    const host = (() => {
      try {
        return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.toLowerCase()
      } catch {
        return ""
      }
    })()

    if (host && cfg.rules.links.blockedDomains.includes(host)) {
      return {
        type: "links",
        ruleName: "Link Filter",
        reason: `Blocked domain: ${host}`,
        action: cfg.rules.links.action,
        timeoutMs: cfg.rules.links.timeoutMs
      }
    }
  }

  return null
}

const detectMentionSpam = (message, cfg) => {
  const rule = cfg.rules.mentionSpam
  if (!rule.enabled) return null
  const mentionCount = message.mentions.users.size + message.mentions.roles.size
  if (mentionCount <= rule.maxMentions) return null

  return {
    type: "mentionSpam",
    ruleName: "Mention Spam",
    reason: `Too many mentions (${mentionCount}/${rule.maxMentions})`,
    action: rule.action,
    timeoutMs: rule.timeoutMs
  }
}

const detectMessageSpam = (message, cfg) => {
  const rule = cfg.rules.messageSpam
  if (!rule.enabled) return null

  const bucket = getBucket(message.guild.id, message.author.id)
  const normalized = normalizeText(message.content || "")
  bucket.push({ ts: Date.now(), text: normalized })
  compactBucket(bucket, Math.max(rule.windowMs, rule.duplicateWindowMs))

  const inWindow = bucket.filter(x => Date.now() - x.ts <= rule.windowMs)
  if (inWindow.length > rule.maxMessages) {
    return {
      type: "messageSpam",
      ruleName: "Message Spam",
      reason: `Rate exceeded (${inWindow.length}/${rule.maxMessages})`,
      action: rule.action,
      timeoutMs: rule.timeoutMs
    }
  }

  const dupWindow = bucket.filter(x => Date.now() - x.ts <= rule.duplicateWindowMs)
  const duplicateCount = dupWindow.filter(x => x.text && x.text === normalized).length
  if (duplicateCount >= rule.maxDuplicates) {
    return {
      type: "messageSpam",
      ruleName: "Message Spam",
      reason: `Repeated message spam (${duplicateCount}/${rule.maxDuplicates})`,
      action: rule.action,
      timeoutMs: rule.timeoutMs
    }
  }

  return null
}

const detectCapsSpam = (content, cfg) => {
  const rule = cfg.rules.capsSpam
  if (!rule.enabled) return null

  const letters = String(content || "").replace(/[^a-z]/gi, "")
  if (letters.length < rule.minLength) return null

  const upper = letters.replace(/[^A-Z]/g, "")
  const ratio = upper.length / letters.length
  if (ratio < rule.maxUppercaseRatio) return null

  return {
    type: "capsSpam",
    ruleName: "Caps Spam",
    reason: `Uppercase ratio too high (${Math.round(ratio * 100)}%)`,
    action: rule.action,
    timeoutMs: rule.timeoutMs
  }
}

const resolveLogChannel = (guild, cfg) => {
  const channelId = cfg.logChannelId || null
  if (!channelId) return null
  const channel = guild.channels.cache.get(channelId)
  return channel && channel.isTextBased() ? channel : null
}

const logTrigger = async ({ message, cfg, trigger, actionTaken, extraMetadata = {}, color = COLORS.warning }) => {
  await logModerationAction({
    guild: message.guild,
    action: actionTaken,
    userId: message.author.id,
    moderatorId: message.guild.members.me?.id,
    reason: trigger.reason,
    color,
    metadata: {
      trigger,
      ...extraMetadata,
      automod: {
        ruleName: trigger.ruleName,
        triggerType: trigger.type,
        actionTaken,
        channelId: message.channel.id,
        userId: message.author.id,
        messagePreview: safePreview(message.content)
      }
    }
  })

  const logChannel = resolveLogChannel(message.guild, cfg)
  if (logChannel) {
    await logChannel.send({
      embeds: [
        {
          title: "AutoMod Triggered",
          color,
          fields: [
            { name: "User", value: `<@${message.author.id}>`, inline: true },
            { name: "User ID", value: message.author.id, inline: true },
            { name: "Channel", value: `<#${message.channel.id}>`, inline: true },
            { name: "Rule", value: trigger.ruleName, inline: true },
            { name: "Action", value: actionTaken, inline: true },
            { name: "Reason", value: escapeMarkdownSafe(trigger.reason), inline: false },
            { name: "Message Preview", value: safePreview(message.content), inline: false }
          ],
          timestamp: new Date().toISOString()
        }
      ]
    }).catch(() => {})
  }
}

const applyAction = async ({ message, cfg, trigger }) => {
  const guild = message.guild
  const member = message.member
  const me = guild.members.me
  if (!member || !me) return { blocked: false }

  const isCoolingDown = await store.isPunishmentCoolingDown(guild.id, message.author.id, trigger.type)
  if (isCoolingDown) return { blocked: true }

  await store.setPunishmentCooldown(guild.id, message.author.id, trigger.type, cfg.cooldownMs)

  if (!me.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
    await logTrigger({ message, cfg, trigger, actionTaken: "permission_error", color: COLORS.error })
    return { blocked: false }
  }

  try {
    await message.delete()
  } catch {
    await logTrigger({ message, cfg, trigger, actionTaken: "delete_failed", color: COLORS.error })
    return { blocked: false }
  }

  await store.addInfraction({
    guildId: guild.id,
    userId: message.author.id,
    triggerType: trigger.type,
    reason: trigger.reason,
    metadata: {
      automod: {
        ruleName: trigger.ruleName,
        actionRequested: trigger.action,
        messagePreview: safePreview(message.content),
        channelId: message.channel.id
      }
    }
  })

  if (trigger.action === "delete_only") {
    await logTrigger({ message, cfg, trigger, actionTaken: "delete_only", color: COLORS.warning })
    return { blocked: true }
  }

  if (!me.permissions.has(PermissionsBitField.Flags.ModerateMembers) || !member.moderatable) {
    await logTrigger({ message, cfg, trigger, actionTaken: "delete_only_permission_fallback", color: COLORS.warning })
    return { blocked: true }
  }

  try {
    await member.timeout(trigger.timeoutMs, `[AutoMod] ${trigger.reason}`)
    await logTrigger({
      message,
      cfg,
      trigger,
      actionTaken: `delete_timeout (${Math.floor(trigger.timeoutMs / 60000)}m)`,
      color: COLORS.warning
    })
  } catch {
    await logTrigger({ message, cfg, trigger, actionTaken: "delete_only_timeout_failed", color: COLORS.warning })
  }

  return { blocked: true }
}

module.exports.handleMessage = async message => {
  try {
    if (!message?.guild || message.author?.bot) return { blocked: false }

    const cfg = await store.getConfig(message.guild.id)
    if (!cfg.enabled || hasBypass(message.member, cfg)) return { blocked: false }

    const triggers = [
      detectBannedWords(message.content || "", cfg),
      detectLinks(message.content || "", cfg),
      detectMentionSpam(message, cfg),
      detectMessageSpam(message, cfg),
      detectCapsSpam(message.content || "", cfg)
    ].filter(Boolean)

    if (!triggers.length) return { blocked: false }

    return await applyAction({ message, cfg, trigger: triggers[0] })
  } catch {
    return { blocked: false }
  }
}
