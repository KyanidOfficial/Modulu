const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  ChannelType
} = require("discord.js")
const systemEmbed = require("../../messages/embeds/system.embed")
const COLORS = require("../../shared/utils/colors")
const { escapeMarkdownSafe } = require("../../shared/utils/safeText")

const ruleLabelMap = {
  bannedWords: "Banned Words",
  links: "Link Filter",
  mentionSpam: "Mention Spam",
  messageSpam: "Message Spam",
  capsSpam: "Caps Spam"
}

const actionLabelMap = {
  delete_only: "Delete only",
  delete_timeout: "Delete + timeout"
}

const linkModeLabelMap = {
  block_all_links: "Block all links",
  allow_whitelist_only: "Allow only whitelisted domains",
  block_invites_only: "Block invite links only",
  block_shortened_urls: "Block shortened URLs"
}

const safe = value => escapeMarkdownSafe(String(value ?? "N/A"))

const summarizeThreshold = (key, rule) => {
  if (key === "bannedWords") return `${rule.words.length} words`
  if (key === "links") return `${linkModeLabelMap[rule.mode] || rule.mode}`
  if (key === "mentionSpam") return `Max mentions: ${rule.maxMentions}`
  if (key === "messageSpam") return `Max msgs: ${rule.maxMessages}/${Math.floor(rule.windowMs / 1000)}s, dup: ${rule.maxDuplicates}`
  if (key === "capsSpam") return `Min len: ${rule.minLength}, ratio: ${Math.round(rule.maxUppercaseRatio * 100)}%`
  return "Configured"
}

const createDashboardEmbed = ({ cfg, recentCount = 0 }) => {
  const fields = Object.entries(cfg.rules).map(([key, rule]) => ({
    name: `${ruleLabelMap[key]} ${rule.enabled ? "✅" : "❌"}`,
    value: [
      `**Action:** ${actionLabelMap[rule.action] || rule.action}`,
      `**Threshold:** ${summarizeThreshold(key, rule)}`,
      `**Timeout:** ${Math.floor((rule.timeoutMs || 0) / 60000)}m`
    ].join("\n"),
    inline: false
  }))

  fields.push({
    name: "Log Channel",
    value: cfg.logChannelId ? `<#${cfg.logChannelId}>` : "Not set",
    inline: true
  })

  fields.push({
    name: "Quick Stats",
    value: `Recent triggers: **${recentCount}**\nCooldown: **${Math.floor(cfg.cooldownMs / 1000)}s**`,
    inline: true
  })

  return systemEmbed({
    title: "AutoMod Dashboard",
    description: "Manage rules with buttons below. All updates are applied instantly.",
    color: COLORS.info
  }).setFields(fields)
}

const createDashboardComponents = () => [
  new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("automod:dashboard:toggle").setLabel("Toggle Rule").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("automod:dashboard:configure").setLabel("Configure Rule").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("automod:dashboard:setlog").setLabel("Set Log Channel").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("automod:dashboard:recent").setLabel("Recent Triggers").setStyle(ButtonStyle.Success)
  ),
  new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("automod:dashboard:words:manage").setLabel("Manage Banned Words").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("automod:dashboard:preset:open").setLabel("Apply Preset").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("automod:dashboard:links:open").setLabel("Link Presets").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("automod:content:view:0").setLabel("View Banned Content").setStyle(ButtonStyle.Secondary)
  )
]

const createRuleSelect = (customId, placeholder) =>
  new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(placeholder)
      .addOptions(
        ...Object.entries(ruleLabelMap).map(([value, label]) => ({ label, value }))
      )
  )

const createBackComponents = () => [
  new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("automod:dashboard:home").setLabel("Back").setStyle(ButtonStyle.Secondary)
  )
]

const createLogChannelSelect = () =>
  new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId("automod:dashboard:setlog:select")
      .setPlaceholder("Select log channel")
      .setChannelTypes(ChannelType.GuildText)
  )

const createPresetSelect = () =>
  new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("automod:preset:select:menu")
      .setPlaceholder("Select banned word preset")
      .addOptions(
        { label: "Racial slurs", value: "racial_slurs" },
        { label: "Hate speech", value: "hate_speech" },
        { label: "Sexual content", value: "sexual_content" },
        { label: "Severe profanity", value: "severe_profanity" }
      )
  )

const createLinkModeSelect = current =>
  new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("automod:links:mode:select:menu")
      .setPlaceholder(`Current: ${linkModeLabelMap[current] || current}`)
      .addOptions(
        { label: "Block all links", value: "block_all_links" },
        { label: "Allow only whitelisted domains", value: "allow_whitelist_only" },
        { label: "Block invite links only", value: "block_invites_only" },
        { label: "Block shortened URLs", value: "block_shortened_urls" }
      )
  )

const createRecentEmbed = rows => {
  const lines = rows.length
    ? rows.map((row, idx) => {
      const reason = safe(row.reason || "No reason")
      const preview = safe(row.metadata?.automod?.messagePreview || "[no preview]")
      return `**${idx + 1}.** <@${row.user_id}>\nRule: **${safe(row.trigger_type)}**\nReason: ${reason}\nPreview: ${preview}\nAt: <t:${Math.floor(new Date(row.created_at).getTime() / 1000)}:R>`
    }).join("\n\n")
    : "No recent triggers."

  return systemEmbed({
    title: "AutoMod Recent Triggers",
    description: lines,
    color: COLORS.warning
  })
}

const createBannedContentEmbed = ({ cfg, page = 0, pageSize = 25 }) => {
  const words = cfg.rules.bannedWords.words || []
  const totalPages = Math.max(1, Math.ceil(words.length / pageSize))
  const safePage = Math.max(0, Math.min(totalPages - 1, page))
  const slice = words.slice(safePage * pageSize, safePage * pageSize + pageSize)

  const sections = [
    `**Banned Words:** ${words.length}`,
    slice.length ? slice.map((word, i) => `${safePage * pageSize + i + 1}. ${safe(word)}`).join("\n") : "No banned words.",
    "",
    `**Active Presets:** ${(cfg.activeBannedWordPresets || []).length ? cfg.activeBannedWordPresets.map(safe).join(", ") : "None"}`,
    `**Link Filter Mode:** ${safe(linkModeLabelMap[cfg.rules.links.mode] || cfg.rules.links.mode)}`,
    `**Whitelisted Domains:** ${(cfg.rules.links.whitelistedDomains || []).length ? cfg.rules.links.whitelistedDomains.map(safe).join(", ") : "None"}`,
    `**Caps Threshold:** Min length ${cfg.rules.capsSpam.minLength}, ratio ${Math.round(cfg.rules.capsSpam.maxUppercaseRatio * 100)}%`,
    `**Spam Threshold:** ${cfg.rules.messageSpam.maxMessages}/${Math.floor(cfg.rules.messageSpam.windowMs / 1000)}s, duplicates ${cfg.rules.messageSpam.maxDuplicates}`,
    `**Mention Limit:** ${cfg.rules.mentionSpam.maxMentions}`,
    `\nPage ${safePage + 1}/${totalPages}`
  ]

  return {
    embed: systemEmbed({
      title: "AutoMod Banned Content",
      description: sections.join("\n"),
      color: COLORS.info
    }),
    page: safePage,
    totalPages
  }
}

const createBannedContentPagination = ({ page, totalPages }) => [
  new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`automod:content:prev:${page}`)
      .setLabel("Previous")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 0),
    new ButtonBuilder()
      .setCustomId(`automod:content:next:${page}`)
      .setLabel("Next")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1),
    new ButtonBuilder().setCustomId("automod:dashboard:home").setLabel("Back").setStyle(ButtonStyle.Secondary)
  )
]

module.exports = {
  ruleLabelMap,
  actionLabelMap,
  linkModeLabelMap,
  createDashboardEmbed,
  createDashboardComponents,
  createRuleSelect,
  createBackComponents,
  createLogChannelSelect,
  createPresetSelect,
  createLinkModeSelect,
  createRecentEmbed,
  createBannedContentEmbed,
  createBannedContentPagination
}
