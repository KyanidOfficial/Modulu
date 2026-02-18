const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  ChannelType
} = require("discord.js")
const systemEmbed = require("../../messages/embeds/system.embed")
const COLORS = require("../../utils/colors")
const { escapeMarkdownSafe } = require("../../utils/safeText")

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

const safe = value => escapeMarkdownSafe(String(value ?? "N/A"))

const summarizeThreshold = (key, rule) => {
  if (key === "bannedWords") return `${rule.words.length} words`
  if (key === "links") return `${rule.blockedDomains.length} blocked domains`
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
    new ButtonBuilder().setCustomId("automod:toggle").setLabel("Toggle Rule").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("automod:configure").setLabel("Configure Rule").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("automod:setlog").setLabel("Set Log Channel").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("automod:recent").setLabel("View Recent Triggers").setStyle(ButtonStyle.Success)
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
    new ButtonBuilder().setCustomId("automod:home").setLabel("Back").setStyle(ButtonStyle.Secondary)
  )
]

const createLogChannelSelect = () =>
  new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId("automod:setlog:select")
      .setPlaceholder("Select log channel")
      .setChannelTypes(ChannelType.GuildText)
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

module.exports = {
  ruleLabelMap,
  actionLabelMap,
  createDashboardEmbed,
  createDashboardComponents,
  createRuleSelect,
  createBackComponents,
  createLogChannelSelect,
  createRecentEmbed
}
