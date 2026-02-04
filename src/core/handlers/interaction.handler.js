const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  PermissionsBitField
} = require("discord.js")

const errorEmbed = require("../../messages/embeds/error.embed")
const successEmbed = require("../../messages/embeds/joinGate.success.embed")
const rejectEmbed = require("../../messages/embeds/joinGate.rejected.embed")
const approveEmbed = require("../../messages/embeds/joinGate.approved.embed")
const feedbackEmbed = require("../../messages/embeds/feedback.embed")
const staffTimeButtons = require("./staffTime.buttons")

const GLOBAL_FEEDBACK_CHANNEL = "1456085711802335353"
const FEEDBACK_COOLDOWN = 1000 * 60 * 60
const feedbackCooldowns = new Map()

module.exports = async (client, interaction) => {
  try {
    if (!interaction) return

    /* BUTTONS */
    if (interaction.isButton()) {
      await staffTimeButtons(interaction)

      const parts = interaction.customId.split("_")
      if (parts[0] !== "joingate") return

      const action = parts[1]
      const userId = parts[2]

      const modal = new ModalBuilder()
        .setCustomId(`joingate_${action}_modal_${userId}`)
        .setTitle(action === "approve" ? "Approve Member" : "Reject Member")

      const reason = new TextInputBuilder()
        .setCustomId("reason")
        .setLabel("Reason")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)

      modal.addComponents(new ActionRowBuilder().addComponents(reason))
      await interaction.showModal(modal)
      return
    }

    /* MODALS */
    if (interaction.isModalSubmit()) {

      /* FEEDBACK */
      if (interaction.customId === "feedback_modal") {
        const guild = interaction.guild
        if (!guild) return

        const last = feedbackCooldowns.get(interaction.user.id)
        if (last && Date.now() - last < FEEDBACK_COOLDOWN) {
          await interaction.reply({
            content: "You already sent feedback. Try again later.",
            ephemeral: true
          })
          return
        }

        feedbackCooldowns.set(interaction.user.id, Date.now())

        const feedback = interaction.fields.getTextInputValue("feedback_message")

        const inviteChannel = guild.channels.cache.find(c =>
          c.type === 0 &&
          c.viewable &&
          c.permissionsFor(guild.members.me)
            ?.has(PermissionsBitField.Flags.CreateInstantInvite)
        )

        let invite = "Unavailable"

        if (inviteChannel) {
          const created = await inviteChannel.createInvite({
            maxAge: 0,
            maxUses: 0,
            unique: true
          }).catch(() => null)

          if (created) invite = created.url
        }

        const embed = feedbackEmbed({
          userTag: interaction.user.tag,
          userId: interaction.user.id,
          avatar: interaction.user.displayAvatarURL({ size: 128 }),
          feedback,
          guildName: guild.name,
          guildId: guild.id,
          invite
        })

        const globalChannel = client.channels.cache.get(GLOBAL_FEEDBACK_CHANNEL)
        if (globalChannel?.isTextBased()) {
          await globalChannel.send({ embeds: [embed] })
        }

        await interaction.reply({
          content: "Feedback sent. Thank you.",
          ephemeral: true
        })

        return
      }

      /* JOIN GATE */
      const parts = interaction.customId.split("_")
      if (parts[0] !== "joingate") return

      const action = parts[1]
      const userId = parts[3]
      const reason = interaction.fields.getTextInputValue("reason")

      if (interaction.user.id === userId) {
        await interaction.reply({
          embeds: [
            errorEmbed({
              users: `<@${interaction.user.id}>`,
              punishment: "join gate",
              state: "failed",
              reason: "You cannot approve or reject yourself."
            })
          ],
          ephemeral: true
        })
        return
      }

      const reviewer = await interaction.guild.members.fetch(interaction.user.id)

      const allowed =
        reviewer.permissions.has(PermissionsBitField.Flags.Administrator) ||
        reviewer.roles.cache.hasAny(
          ...interaction.guild.roles.cache
            .filter(r => ["Moderator", "Admin"].includes(r.name))
            .map(r => r.id)
        )

      if (!allowed) {
        await interaction.reply({
          embeds: [
            errorEmbed({
              users: `<@${interaction.user.id}>`,
              punishment: "join gate",
              state: "failed",
              reason: "You are not allowed to review join gate cases."
            })
          ],
          ephemeral: true
        })
        return
      }

      const member = await interaction.guild.members.fetch(userId).catch(() => null)
      if (!member) {
        await interaction.reply({
          embeds: [
            errorEmbed({
              users: "Unknown",
              punishment: "join gate",
              state: "failed",
              reason: "Member not found"
            })
          ],
          ephemeral: true
        })
        return
      }

      const gateRole = interaction.guild.roles.cache.find(r => r.name === "Join Gate")
      if (gateRole) {
        await member.roles.remove(gateRole).catch(() => {})
      }

      if (action === "reject") {
        await member.send({
          embeds: [
            rejectEmbed({
              guild: interaction.guild,
              reviewer: interaction.user.tag,
              reason
            })
          ]
        }).catch(() => {})

        await member.kick(reason).catch(() => {})
      }

      if (action === "approve") {
        await member.send({
          embeds: [
            approveEmbed({
              guild: interaction.guild,
              reviewer: interaction.user.tag,
              reason
            })
          ]
        }).catch(() => {})
      }

      await interaction.reply({
        embeds: [
          successEmbed({
            users: `<@${interaction.user.id}>`,
            punishment: "join gate",
            state: "completed",
            reason
          })
        ],
        ephemeral: true
      })

      const channel = interaction.channel
      if (channel?.deletable) {
        setTimeout(() => channel.delete().catch(() => {}), 3000)
      }

      return
    }

    /* SLASH COMMANDS */
    if (!interaction.isChatInputCommand()) return

    const command = client.commands.get(interaction.commandName)
    if (!command || typeof command.execute !== "function") return

    if (!interaction.deferred && !interaction.replied) {
      try {
        await interaction.deferReply()
      } catch (err) {
        if (err.code === 10062) return
        throw err
      }
    }

    await command.execute(interaction)

  } catch (err) {
    console.error("interaction.handler error")
    console.error(err)

    try {
      if (!interaction.isRepliable()) return
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({
          embeds: [
            errorEmbed({
              users: interaction.user ? `<@${interaction.user.id}>` : "Unknown",
              punishment: "command",
              state: "failed",
              reason: "Internal error"
            })
          ]
        })
      } else {
        await interaction.reply({
          embeds: [
            errorEmbed({
              users: interaction.user ? `<@${interaction.user.id}>` : "Unknown",
              punishment: "command",
              state: "failed",
              reason: "Internal error"
            })
          ],
          ephemeral: true
        })
      }
    } catch {}
  }
}
