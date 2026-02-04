const { SlashCommandBuilder, EmbedBuilder } = require("discord.js")
const db = require("../../../core/database")
const joinGateDb = require("../../../core/database/joinGate")
const harmfulLinksDb = require("../../../core/database/harmfulLinks")
const COLORS = require("../../../utils/colors")

module.exports = {
  data: new SlashCommandBuilder()
    .setName("server")
    .setDescription("Server utilities")
    .addSubcommand(s =>
      s.setName("settings").setDescription("View server settings")
    ),

  async execute(interaction) {
    const guild = interaction.guild
    if (!guild) throw new Error("No guild")

    const row = await db.get(guild.id)
    const setup = row?.setup

    if (!setup || !setup.completed) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.error)
            .setTitle("Server settings")
            .setDescription("This server has not been set up yet.")
        ]
      })
    }

    const gate = await joinGateDb.get(guild.id)
    const harmful = await harmfulLinksDb.get(guild.id)

    const mods =
      setup.roles.moderators.length
        ? setup.roles.moderators.map(id => `<@&${id}>`).join(", ")
        : "None"

    const admins =
      setup.roles.administrators.length
        ? setup.roles.administrators.map(id => `<@&${id}>`).join(", ")
        : "None"

    const hlTimeoutMinutes =
      harmful?.timeout
        ? Math.max(1, Math.round((harmful.timeout_time || 600) / 60))
        : 0

    const embed = new EmbedBuilder()
      .setColor(COLORS.success)
      .setTitle("Server settings")
      .setDescription(
        `**Roles**\n` +
        `Moderator roles: ${mods}\n` +
        `Administrator roles: ${admins}\n\n` +

        `**Channels**\n` +
        `Moderation logs: ${setup.channels.logs ? `<#${setup.channels.logs}>` : "None"}\n` +
        `Server logs: ${setup.channels.serverLogs ? `<#${setup.channels.serverLogs}>` : "None"}\n` +
        `Chat logs: ${setup.channels.chatLogs ? `<#${setup.channels.chatLogs}>` : "None"}\n\n` +

        `**Features**\n` +
        `DM on punish: ${setup.features.dmOnPunish ? "On" : "Off"}\n` +
        `Server logs: ${setup.features.serverLogs ? "On" : "Off"}\n` +
        `Chat logs: ${setup.features.chatLogs ? "On" : "Off"}\n` +
        `Harmful links: ${setup.features.harmfulLinks ? "On" : "Off"}\n\n` +

        `**Harmful Links**\n` +
        `Status: ${harmful?.enabled ? "On" : "Off"}\n` +
        `Scan staff: ${harmful?.scan_staff ? "Yes" : "No"}\n` +
        `Timeout: ${harmful?.timeout ? "On" : "Off"}\n` +
        (harmful?.timeout ? `Timeout duration: ${hlTimeoutMinutes} min\n` : "") +
        `Logging: ${harmful?.log_enabled ? "On" : "Off"}\n\n` +

        `**Join Gate**\n` +
        `Status: ${gate?.enabled ? "On" : "Off"}\n` +
        `Account age: ${gate?.account_age_days ?? 7} days\n` +
        `Require avatar: ${gate?.require_avatar ? "Yes" : "No"}`
      )

    return interaction.editReply({ embeds: [embed] })
  }
}