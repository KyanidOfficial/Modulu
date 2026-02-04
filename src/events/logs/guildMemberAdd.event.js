const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField
} = require("discord.js")

const db = require("../../core/database")
const joinGateDb = require("../../core/database/joinGate")
const raidState = require("../../core/raid/raidState")

const infoEmbed = require("../../messages/embeds/info.embed")
const joinGateEmbed = require("../../messages/embeds/joinGate.embed")
const logServerEvent = require("../../utils/logServerEvent")
const serverLogEmbed = require("../../messages/embeds/serverLog.embed")
const dmUser = require("../../utils/dmUser")

module.exports = async (client, member) => {
  console.log("[JOIN] member joined", member.user.username)

  const createdAt = member.user.createdAt.getTime()
  const ageDays = Math.floor((Date.now() - createdAt) / 86400000)

  const raidActive = await raidState.isActive(member.guild.id)
  const gate = await joinGateDb.get(member.guild.id)

  logServerEvent(
    member.guild,
    serverLogEmbed({
      event: "Member joined",
      target: `<@${member.id}>`,
      details:
        `**ID:** ${member.id}\n` +
        `**Account age:** ${ageDays} days\n`
    })
  )

  if (!gate?.enabled && !raidActive) return

  console.log("[JOIN GATE] check start", member.user.username)

  const reasons = []

  const requiredAge = raidActive
    ? Math.max(gate.account_age_days, 7)
    : gate.account_age_days

  if (ageDays < requiredAge) {
    reasons.push("your account is too new")
  }

  if (gate.require_avatar && !member.user.avatar) {
    reasons.push("your account has no profile picture")
  }

  if (!reasons.length && !raidActive) return

  if (raidActive && !reasons.length) {
    reasons.push("server is under raid protection")
  }

  console.log("[JOIN GATE] triggered", reasons)

  let role = member.guild.roles.cache.find(r => r.name === "Join Gate")

  if (!role) {
    role = await member.guild.roles.create({
      name: "Join Gate",
      permissions: [],
      reason: "Join Gate isolation role"
    })

    for (const channel of member.guild.channels.cache.values()) {
      if (!channel.isTextBased() && !channel.isVoiceBased()) continue
      await channel.permissionOverwrites
        .edit(role.id, { ViewChannel: false })
        .catch(() => {})
    }
  }

  await member.roles.add(role).catch(() => {})

  const count =
    member.guild.channels.cache.filter(c =>
      c.name.startsWith(`${member.user.username}_`)
    ).size + 1

  const channel = await member.guild.channels.create({
    name: `${member.user.username}_${count}`,
    type: 0,
    permissionOverwrites: [
      {
        id: member.guild.roles.everyone.id,
        deny: [PermissionsBitField.Flags.ViewChannel]
      },
      {
        id: member.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory
        ]
      },
      ...member.guild.roles.cache
        .filter(r =>
          r.permissions.has(PermissionsBitField.Flags.ManageGuild)
        )
        .map(r => ({
          id: r.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory
          ]
        }))
    ]
  })

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`joingate_approve_${member.id}`)
      .setLabel("Approve")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`joingate_reject_${member.id}`)
      .setLabel("Reject")
      .setStyle(ButtonStyle.Danger)
  )

  await channel.send({
    embeds: [
      infoEmbed({
        title: "Join Gate Review",
        description:
          `User: <@${member.id}>\n\nReasons:\n- ${reasons.join("\n- ")}`
      })
    ],
    components: [row]
  })

  await dmUser(
    member.guild.id,
    member.user,
    joinGateEmbed({
      user: member.user.tag,
      action: "join gate",
      state: raidActive ? "forced" : "triggered",
      reason: reasons.join(", ")
    })
  )

  logServerEvent(
    member.guild,
    serverLogEmbed({
      event: raidActive ? "Join Gate Forced" : "Join Gate Triggered",
      target: `<@${member.id}>`,
      details: reasons.join(", ")
    })
  )
}