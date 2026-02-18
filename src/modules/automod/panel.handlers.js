const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js")
const store = require("./store")
const systemEmbed = require("../../messages/embeds/system.embed")
const COLORS = require("../../utils/colors")
const {
  ruleLabelMap,
  createDashboardEmbed,
  createDashboardComponents,
  createRuleSelect,
  createBackComponents,
  createLogChannelSelect,
  createRecentEmbed
} = require("./panel")

const parseNumber = (value, fallback, min, max) => {
  const num = Number(value)
  if (!Number.isFinite(num)) return fallback
  return Math.max(min, Math.min(max, num))
}

const buildModalForRule = (ruleKey, cfg, messageId) => {
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

module.exports = async interaction => {
  if (interaction.isButton() && interaction.customId.startsWith("automod:")) {
    const cfg = await store.getConfig(interaction.guild.id)
    const recent = await store.getRecentInfractions(interaction.guild.id, 10)

    if (interaction.customId === "automod:home") {
      return interaction.update({
        embeds: [createDashboardEmbed({ cfg, recentCount: recent.length })],
        components: createDashboardComponents()
      })
    }

    if (interaction.customId === "automod:toggle") {
      return interaction.update({
        embeds: [systemEmbed({ title: "Toggle Rule", description: "Select a rule to toggle.", color: COLORS.info })],
        components: [createRuleSelect("automod:toggle:select", "Choose a rule"), ...createBackComponents()]
      })
    }

    if (interaction.customId === "automod:configure") {
      return interaction.update({
        embeds: [systemEmbed({ title: "Configure Rule", description: "Select a rule to configure.", color: COLORS.info })],
        components: [createRuleSelect("automod:configure:select", "Choose a rule"), ...createBackComponents()]
      })
    }

    if (interaction.customId === "automod:setlog") {
      return interaction.update({
        embeds: [systemEmbed({ title: "Set Log Channel", description: "Select the channel for AutoMod logs.", color: COLORS.info })],
        components: [createLogChannelSelect(), ...createBackComponents()]
      })
    }

    if (interaction.customId === "automod:recent") {
      const rows = await store.getRecentInfractions(interaction.guild.id, 10)
      return interaction.update({
        embeds: [createRecentEmbed(rows)],
        components: createBackComponents()
      })
    }
  }

  if (interaction.isStringSelectMenu() && interaction.customId === "automod:toggle:select") {
    const cfg = await store.getConfig(interaction.guild.id)
    const ruleKey = interaction.values[0]
    cfg.rules[ruleKey].enabled = !cfg.rules[ruleKey].enabled
    await store.saveConfig(interaction.guild.id, cfg)
    const recent = await store.getRecentInfractions(interaction.guild.id, 10)

    return interaction.update({
      embeds: [createDashboardEmbed({ cfg, recentCount: recent.length })],
      components: createDashboardComponents()
    })
  }

  if (interaction.isStringSelectMenu() && interaction.customId === "automod:configure:select") {
    const cfg = await store.getConfig(interaction.guild.id)
    const ruleKey = interaction.values[0]
    const modal = buildModalForRule(ruleKey, cfg, interaction.message.id)
    return interaction.showModal(modal)
  }

  if (interaction.isChannelSelectMenu() && interaction.customId === "automod:setlog:select") {
    const cfg = await store.getConfig(interaction.guild.id)
    cfg.logChannelId = interaction.values[0] || null
    await store.saveConfig(interaction.guild.id, cfg)
    const recent = await store.getRecentInfractions(interaction.guild.id, 10)

    return interaction.update({
      embeds: [createDashboardEmbed({ cfg, recentCount: recent.length })],
      components: createDashboardComponents()
    })
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
      rule.words = thresholdRaw.split(",").map(v => v.trim()).filter(Boolean)
    }

    if (ruleKey === "links") {
      rule.blockedDomains = thresholdRaw.split(",").map(v => v.trim().toLowerCase()).filter(Boolean)
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
}
