const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js")
const store = require("./store")
const systemEmbed = require("../../messages/embeds/system.embed")
const COLORS = require("../../shared/utils/colors")
const {
  BANNED_WORD_PRESETS,
  normalizeWord,
  uniqueNormalized
} = require("./presets")
const {
  ruleLabelMap,
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
} = require("./panel")

const parseNumber = (value, fallback, min, max) => {
  const num = Number(value)
  if (!Number.isFinite(num)) return fallback
  return Math.max(min, Math.min(max, num))
}

const parseDomainList = raw =>
  String(raw || "")
    .split(",")
    .map(v => v.trim().toLowerCase())
    .filter(Boolean)
    .map(v => v.replace(/^https?:\/\//, "").replace(/\/.*$/, ""))

const buildRuleConfigModal = (ruleKey, cfg, messageId) => {
  const modal = new ModalBuilder()
    .setCustomId(`automod:configure:modal:${ruleKey}:${messageId}`)
    .setTitle(`Configure ${ruleLabelMap[ruleKey]}`)

  const rule = cfg.rules[ruleKey]

  const actionInput = new TextInputBuilder()
    .setCustomId("action")
    .setLabel("Action (delete_only or delete_timeout)")
    .setStyle(TextInputStyle.Short)
    .setValue(rule.action)
    .setRequired(true)

  const timeoutInput = new TextInputBuilder()
    .setCustomId("timeout")
    .setLabel("Timeout minutes")
    .setStyle(TextInputStyle.Short)
    .setValue(String(Math.floor((rule.timeoutMs || 0) / 60000)))
    .setRequired(true)

  const thresholdInput = new TextInputBuilder()
    .setCustomId("threshold")
    .setLabel("Threshold / values")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)

  if (ruleKey === "bannedWords") thresholdInput.setValue(rule.words.join(", "))
  if (ruleKey === "links") thresholdInput.setValue(rule.blockedDomains.join(", "))
  if (ruleKey === "mentionSpam") thresholdInput.setValue(String(rule.maxMentions))
  if (ruleKey === "messageSpam") thresholdInput.setValue(`${rule.maxMessages},${Math.floor(rule.windowMs / 1000)},${rule.maxDuplicates}`)
  if (ruleKey === "capsSpam") thresholdInput.setValue(`${rule.minLength},${Math.round(rule.maxUppercaseRatio * 100)}`)

  modal.addComponents(
    new ActionRowBuilder().addComponents(actionInput),
    new ActionRowBuilder().addComponents(timeoutInput),
    new ActionRowBuilder().addComponents(thresholdInput)
  )

  return modal
}

const buildWordsModal = messageId => {
  const modal = new ModalBuilder()
    .setCustomId(`automod:words:modal:${messageId}`)
    .setTitle("Manage Banned Words")

  const modeInput = new TextInputBuilder()
    .setCustomId("mode")
    .setLabel("Mode (add or remove)")
    .setStyle(TextInputStyle.Short)
    .setValue("add")
    .setRequired(true)

  const wordsInput = new TextInputBuilder()
    .setCustomId("words")
    .setLabel("Comma separated words")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)

  modal.addComponents(
    new ActionRowBuilder().addComponents(modeInput),
    new ActionRowBuilder().addComponents(wordsInput)
  )

  return modal
}

const buildWhitelistModal = messageId => {
  const modal = new ModalBuilder()
    .setCustomId(`automod:links:whitelist:modal:${messageId}`)
    .setTitle("Manage Whitelisted Domains")

  const modeInput = new TextInputBuilder()
    .setCustomId("mode")
    .setLabel("Mode (add or remove)")
    .setStyle(TextInputStyle.Short)
    .setValue("add")
    .setRequired(true)

  const domainsInput = new TextInputBuilder()
    .setCustomId("domains")
    .setLabel("Comma separated domains")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)

  modal.addComponents(
    new ActionRowBuilder().addComponents(modeInput),
    new ActionRowBuilder().addComponents(domainsInput)
  )

  return modal
}

const renderDashboard = async interaction => {
  const cfg = await store.getConfig(interaction.guild.id)
  const recent = await store.getRecentInfractions(interaction.guild.id, 10)

  return interaction.update({
    embeds: [createDashboardEmbed({ cfg, recentCount: recent.length })],
    components: createDashboardComponents()
  })
}

module.exports = async interaction => {
  if (interaction.isButton() && interaction.customId.startsWith("automod:")) {
    const cfg = await store.getConfig(interaction.guild.id)

    if (interaction.customId === "automod:dashboard:home") {
      return renderDashboard(interaction)
    }

    if (interaction.customId === "automod:dashboard:toggle") {
      return interaction.update({
        embeds: [systemEmbed({ title: "Toggle Rule", description: "Select a rule to toggle.", color: COLORS.info })],
        components: [createRuleSelect("automod:dashboard:toggle:select", "Choose a rule"), ...createBackComponents()]
      })
    }

    if (interaction.customId === "automod:dashboard:configure") {
      return interaction.update({
        embeds: [systemEmbed({ title: "Configure Rule", description: "Select a rule to configure.", color: COLORS.info })],
        components: [createRuleSelect("automod:dashboard:configure:select", "Choose a rule"), ...createBackComponents()]
      })
    }

    if (interaction.customId === "automod:dashboard:setlog") {
      return interaction.update({
        embeds: [systemEmbed({ title: "Set Log Channel", description: "Select the channel for AutoMod logs.", color: COLORS.info })],
        components: [createLogChannelSelect(), ...createBackComponents()]
      })
    }

    if (interaction.customId === "automod:dashboard:recent") {
      const rows = await store.getRecentInfractions(interaction.guild.id, 10)
      return interaction.update({
        embeds: [createRecentEmbed(rows)],
        components: createBackComponents()
      })
    }

    if (interaction.customId === "automod:dashboard:words:manage") {
      const modal = buildWordsModal(interaction.message.id)
      return interaction.showModal(modal)
    }

    if (interaction.customId === "automod:dashboard:preset:open") {
      return interaction.update({
        embeds: [systemEmbed({ title: "Apply Preset", description: "Select a banned word preset to merge.", color: COLORS.info })],
        components: [createPresetSelect(), ...createBackComponents()]
      })
    }

    if (interaction.customId === "automod:dashboard:links:open") {
      return interaction.update({
        embeds: [systemEmbed({ title: "Link Filter Presets", description: "Choose mode or manage whitelist domains.", color: COLORS.info })],
        components: [
          createLinkModeSelect(cfg.rules.links.mode),
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("automod:links:whitelist:open").setLabel("Manage Whitelist").setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId("automod:links:whitelist:view").setLabel("View Whitelist").setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId("automod:dashboard:home").setLabel("Back").setStyle(ButtonStyle.Secondary)
          )
        ]
      })
    }

    if (interaction.customId === "automod:links:whitelist:open") {
      const modal = buildWhitelistModal(interaction.message.id)
      return interaction.showModal(modal)
    }

    if (interaction.customId === "automod:links:whitelist:view") {
      const domains = cfg.rules.links.whitelistedDomains
      return interaction.update({
        embeds: [systemEmbed({
          title: "Whitelisted Domains",
          description: domains.length ? domains.map(d => `• ${d}`).join("\n") : "No whitelisted domains.",
          color: COLORS.info
        })],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("automod:dashboard:links:open").setLabel("Back to Link Presets").setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId("automod:dashboard:home").setLabel("Dashboard").setStyle(ButtonStyle.Secondary)
          )
        ]
      })
    }

    if (interaction.customId.startsWith("automod:content:view:")) {
      const page = Number(interaction.customId.split(":")[3] || "0")
      const view = createBannedContentEmbed({ cfg, page })
      return interaction.update({
        embeds: [view.embed],
        components: createBannedContentPagination(view)
      })
    }

    if (interaction.customId.startsWith("automod:content:prev:")) {
      const current = Number(interaction.customId.split(":")[3] || "0")
      const view = createBannedContentEmbed({ cfg, page: Math.max(0, current - 1) })
      return interaction.update({ embeds: [view.embed], components: createBannedContentPagination(view) })
    }

    if (interaction.customId.startsWith("automod:content:next:")) {
      const current = Number(interaction.customId.split(":")[3] || "0")
      const view = createBannedContentEmbed({ cfg, page: current + 1 })
      return interaction.update({ embeds: [view.embed], components: createBannedContentPagination(view) })
    }
  }

  if (interaction.isStringSelectMenu() && interaction.customId === "automod:dashboard:toggle:select") {
    const cfg = await store.getConfig(interaction.guild.id)
    const ruleKey = interaction.values[0]
    cfg.rules[ruleKey].enabled = !cfg.rules[ruleKey].enabled
    await store.saveConfig(interaction.guild.id, cfg)
    return renderDashboard(interaction)
  }

  if (interaction.isStringSelectMenu() && interaction.customId === "automod:dashboard:configure:select") {
    const cfg = await store.getConfig(interaction.guild.id)
    const ruleKey = interaction.values[0]
    const modal = buildRuleConfigModal(ruleKey, cfg, interaction.message.id)
    return interaction.showModal(modal)
  }

  if (interaction.isStringSelectMenu() && interaction.customId === "automod:preset:select:menu") {
    const cfg = await store.getConfig(interaction.guild.id)
    const presetKey = interaction.values[0]
    const presetWords = BANNED_WORD_PRESETS[presetKey] || []

    const before = cfg.rules.bannedWords.words.length
    cfg.rules.bannedWords.words = uniqueNormalized([...cfg.rules.bannedWords.words, ...presetWords])
    if (!cfg.activeBannedWordPresets.includes(presetKey)) cfg.activeBannedWordPresets.push(presetKey)
    const after = cfg.rules.bannedWords.words.length
    const added = after - before

    await store.saveConfig(interaction.guild.id, cfg)

    return interaction.update({
      embeds: [systemEmbed({
        title: "Preset Applied",
        description: `Preset **${presetKey}** applied successfully. Added **${added}** words.`,
        color: COLORS.success
      })],
      components: createBackComponents()
    })
  }

  if (interaction.isStringSelectMenu() && interaction.customId === "automod:links:mode:select:menu") {
    const cfg = await store.getConfig(interaction.guild.id)
    const mode = interaction.values[0]
    cfg.rules.links.mode = mode
    await store.saveConfig(interaction.guild.id, cfg)

    return interaction.update({
      embeds: [systemEmbed({
        title: "Link Preset Updated",
        description: `Link mode set to **${linkModeLabelMap[mode] || mode}**.`,
        color: COLORS.success
      })],
      components: [
        createLinkModeSelect(cfg.rules.links.mode),
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("automod:links:whitelist:open").setLabel("Manage Whitelist").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId("automod:links:whitelist:view").setLabel("View Whitelist").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId("automod:dashboard:home").setLabel("Back").setStyle(ButtonStyle.Secondary)
        )
      ]
    })
  }

  if (interaction.isChannelSelectMenu() && interaction.customId === "automod:dashboard:setlog:select") {
    const cfg = await store.getConfig(interaction.guild.id)
    cfg.logChannelId = interaction.values[0] || null
    await store.saveConfig(interaction.guild.id, cfg)
    return renderDashboard(interaction)
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith("automod:configure:modal:")) {
    const [, , , ruleKey, messageId] = interaction.customId.split(":")
    const cfg = await store.getConfig(interaction.guild.id)
    const rule = cfg.rules[ruleKey]

    if (!rule) {
      return interaction.reply({
        embeds: [systemEmbed({ title: "AutoMod", description: "Rule not found.", color: COLORS.error })],
        ephemeral: true
      })
    }

    const action = interaction.fields.getTextInputValue("action")
    const timeoutMin = parseNumber(interaction.fields.getTextInputValue("timeout"), 10, 1, 10080)
    const thresholdRaw = interaction.fields.getTextInputValue("threshold")

    rule.action = action === "delete_only" ? "delete_only" : "delete_timeout"
    rule.timeoutMs = timeoutMin * 60000

    if (ruleKey === "bannedWords") {
      rule.words = uniqueNormalized(thresholdRaw.split(","))
    }

    if (ruleKey === "links") {
      rule.blockedDomains = uniqueNormalized(parseDomainList(thresholdRaw))
    }

    if (ruleKey === "mentionSpam") {
      rule.maxMentions = parseNumber(thresholdRaw, rule.maxMentions, 1, 100)
    }

    if (ruleKey === "messageSpam") {
      const [maxMessages, windowSec, maxDuplicates] = thresholdRaw.split(",").map(v => Number(v.trim()))
      rule.maxMessages = parseNumber(maxMessages, rule.maxMessages, 2, 50)
      rule.windowMs = parseNumber(windowSec, Math.floor(rule.windowMs / 1000), 2, 120) * 1000
      rule.maxDuplicates = parseNumber(maxDuplicates, rule.maxDuplicates, 2, 20)
    }

    if (ruleKey === "capsSpam") {
      const [minLength, ratioPercent] = thresholdRaw.split(",").map(v => Number(v.trim()))
      rule.minLength = parseNumber(minLength, rule.minLength, 5, 200)
      rule.maxUppercaseRatio = parseNumber(ratioPercent, Math.round(rule.maxUppercaseRatio * 100), 10, 100) / 100
    }

    await store.saveConfig(interaction.guild.id, cfg)

    await interaction.reply({
      embeds: [systemEmbed({ title: "AutoMod Updated", description: `${ruleLabelMap[ruleKey]} was updated.`, color: COLORS.success })],
      ephemeral: true
    })

    const recent = await store.getRecentInfractions(interaction.guild.id, 10)
    const message = await interaction.channel.messages.fetch(messageId).catch(() => null)
    if (message) {
      await message.edit({
        embeds: [createDashboardEmbed({ cfg, recentCount: recent.length })],
        components: createDashboardComponents()
      })
    }
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith("automod:words:modal:")) {
    const messageId = interaction.customId.split(":")[3]
    const cfg = await store.getConfig(interaction.guild.id)
    const mode = interaction.fields.getTextInputValue("mode").trim().toLowerCase()
    const words = uniqueNormalized(interaction.fields.getTextInputValue("words").split(","))

    const before = cfg.rules.bannedWords.words.length

    if (mode === "remove") {
      const removeSet = new Set(words)
      cfg.rules.bannedWords.words = cfg.rules.bannedWords.words.filter(word => !removeSet.has(normalizeWord(word)))
    } else {
      cfg.rules.bannedWords.words = uniqueNormalized([...cfg.rules.bannedWords.words, ...words])
    }

    const after = cfg.rules.bannedWords.words.length
    await store.saveConfig(interaction.guild.id, cfg)

    await interaction.reply({
      embeds: [systemEmbed({
        title: "Banned Words Updated",
        description: mode === "remove"
          ? `Removed **${Math.max(0, before - after)}** words.`
          : `Added **${Math.max(0, after - before)}** words.`,
        color: COLORS.success
      })],
      ephemeral: true
    })

    const message = await interaction.channel.messages.fetch(messageId).catch(() => null)
    if (message) {
      const recent = await store.getRecentInfractions(interaction.guild.id, 10)
      await message.edit({
        embeds: [createDashboardEmbed({ cfg, recentCount: recent.length })],
        components: createDashboardComponents()
      })
    }
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith("automod:links:whitelist:modal:")) {
    const messageId = interaction.customId.split(":")[4]
    const cfg = await store.getConfig(interaction.guild.id)
    const mode = interaction.fields.getTextInputValue("mode").trim().toLowerCase()
    const domains = uniqueNormalized(parseDomainList(interaction.fields.getTextInputValue("domains")))

    if (!domains.length) {
      return interaction.reply({
        embeds: [systemEmbed({ title: "Invalid Domains", description: "No valid domains provided.", color: COLORS.error })],
        ephemeral: true
      })
    }

    const before = cfg.rules.links.whitelistedDomains.length

    if (mode === "remove") {
      const removeSet = new Set(domains)
      cfg.rules.links.whitelistedDomains = cfg.rules.links.whitelistedDomains.filter(domain => !removeSet.has(domain))
    } else {
      cfg.rules.links.whitelistedDomains = uniqueNormalized([...cfg.rules.links.whitelistedDomains, ...domains])
    }

    const after = cfg.rules.links.whitelistedDomains.length
    await store.saveConfig(interaction.guild.id, cfg)

    await interaction.reply({
      embeds: [systemEmbed({
        title: "Whitelist Updated",
        description: mode === "remove"
          ? `Removed **${Math.max(0, before - after)}** domains.`
          : `Added **${Math.max(0, after - before)}** domains.`,
        color: COLORS.success
      })],
      ephemeral: true
    })

    const message = await interaction.channel.messages.fetch(messageId).catch(() => null)
    if (message) {
      const recent = await store.getRecentInfractions(interaction.guild.id, 10)
      await message.edit({
        embeds: [createDashboardEmbed({ cfg, recentCount: recent.length })],
        components: createDashboardComponents()
      })
    }
  }
}
