const { EmbedBuilder } = require("discord.js")
const COLORS = require("../../utils/colors")

module.exports = data => {
  const mods =
    data.roles?.moderators?.length
      ? data.roles.moderators.map(id => `<@&${id}>`).join(", ")
      : "None"

  const admins =
    data.roles?.administrators?.length
      ? data.roles.administrators.map(id => `<@&${id}>`).join(", ")
      : "None"

  const modLogs =
    data.channels?.logs
      ? `<#${data.channels.logs}>`
      : "None"

  const serverLogs =
    data.channels?.serverLogs
      ? `<#${data.channels.serverLogs}>`
      : "None"

  const chatLogs =
    data.channels?.chatLogs
      ? `<#${data.channels.chatLogs}>`
      : "None"

  const appeals =
    data.channels?.appeals
      ? `<#${data.channels.appeals}>`
      : "None"

  const joinGate = data.joinGate || {}
  const harmful = data.harmfulLinks || {}

  const hlTimeoutMinutes =
    harmful.timeout?.enabled
      ? Math.max(1, Math.round((harmful.timeout.duration || 0) / 60000))
      : 0

  return new EmbedBuilder()
    .setColor(COLORS.success)
    .setTitle("Setup preview")
    .setDescription(
      `**Roles**\n` +
      `Moderator: ${mods}\n` +
      `Administrator: ${admins}\n\n` +

      `**Channels**\n` +
      `Mod logs: ${modLogs}\n` +
      `Server logs: ${serverLogs}\n` +
      `Chat logs: ${chatLogs}\n\n` +

      `**Features**\n` +
      `DM on punish: ${data.features?.dmOnPunish ? "Enabled" : "Disabled"}\n` +
      `Server logs: ${data.features?.serverLogs ? "Enabled" : "Disabled"}\n` +
      `Chat logs: ${data.features?.chatLogs ? "Enabled" : "Disabled"}\n` +
      `Harmful links: ${data.features?.harmfulLinks ? "Enabled" : "Disabled"}\n\n` +

      `**Harmful Links**\n` +
      `Scan staff: ${harmful.scanStaff ? "Enabled" : "Disabled"}\n` +
      `Timeout: ${harmful.timeout?.enabled ? "Enabled" : "Disabled"}\n` +
      (harmful.timeout?.enabled
        ? `Timeout duration: ${hlTimeoutMinutes} min\n`
        : "") +
      `Logging: ${harmful.log ? "Enabled" : "Disabled"}\n\n` +

      `**Join Gate**\n` +
      `Enabled: ${joinGate.enabled ? "Enabled" : "Disabled"}\n` +
      `Min account age: ${joinGate.accountAgeDays ?? 0} days\n` +
      `Require avatar: ${joinGate.requireAvatar ? "Enabled" : "Disabled"}`
    )
}