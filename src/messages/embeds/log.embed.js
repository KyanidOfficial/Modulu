const { EmbedBuilder } = require("discord.js")
const COLORS = require("../../shared/utils/colors")
const { escapeMarkdownSafe } = require("../../shared/utils/safeText")

const display = value => escapeMarkdownSafe(String(value ?? "N/A"))

module.exports = data => {
  const metadata = data?.metadata || {}
  const automod = metadata.automod || null

  const embed = new EmbedBuilder()
    .setColor(data?.color || COLORS.warning)
    .setTitle("Moderation log")
    .setDescription(
      `${data?.caseId ? `**Case ID:** ${data.caseId}\n` : ""}` +
      `**Action:** ${display(data?.punishment || "Unknown")}\n` +
      `**User:** ${data?.user || "Unknown"}\n` +
      `**Moderator:** ${data?.moderator || "Unknown"}\n` +
      `**Reason:** ${display(data?.reason || "No reason provided")}\n` +
      `**Warning Count:** ${display(data?.warningCount ?? "N/A")}\n` +
      `**Duration:** ${display(data?.duration || "N/A")}\n` +
      `**Expires at:** ${data?.expiresAt ? `<t:${data.expiresAt}:F>` : "N/A"}`
    )
    .setFooter({ text: `Moderation Log` })
    .setTimestamp()

  if (automod) {
    embed.addFields(
      {
        name: "Rule",
        value: display(automod.ruleName || metadata.trigger?.type || "unknown"),
        inline: true
      },
      {
        name: "Channel",
        value: automod.channelId ? `<#${automod.channelId}>` : "N/A",
        inline: true
      },
      {
        name: "User ID",
        value: display(automod.userId || data?.userId || "N/A"),
        inline: true
      },
      {
        name: "Action Taken",
        value: display(automod.actionTaken || data?.punishment || "unknown"),
        inline: true
      },
      {
        name: "Trigger Type",
        value: display(automod.triggerType || metadata.trigger?.type || "unknown"),
        inline: true
      },
      {
        name: "Message Preview",
        value: display(automod.messagePreview || "[no preview]"),
        inline: false
      }
    )
  }

  return embed
}
