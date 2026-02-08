const db = require("../../core/database/applications")
const systemEmbed = require("../../messages/embeds/system.embed")
const COLORS = require("../../utils/colors")
const {
  canStartApplication,
  startSession,
  cancelSession
} = require("./session.store")

const buildQuestionEmbed = ({ question, index, total, type }) =>
  systemEmbed({
    title: `Application: ${type}`,
    description:
      `Question ${index + 1} of ${total}\n\n${question.prompt}\n\n` +
      "Reply in this DM to continue. Type `cancel` to stop.",
    color: COLORS.info
  })

const sendQuestion = async session => {
  const question = session.questions[session.index]
  if (!question) return

  await session.dm.send({
    embeds: [
      buildQuestionEmbed({
        question,
        index: session.index,
        total: session.questions.length,
        type: session.type
      })
    ]
  })
}

module.exports = async interaction => {
  if (!interaction.inGuild() || !interaction.guild) {
    await interaction.editReply({
      embeds: [
        systemEmbed({
          title: "Unavailable",
          description: "Applications can only be started from a server.",
          color: COLORS.warning
        })
      ]
    })
    return
  }

  const type = interaction.options.getString("type").trim().toLowerCase()
  const config = await db.getConfig(interaction.guild.id, type)

  if (!config || config.state !== "open") {
    await interaction.editReply({
      embeds: [
        systemEmbed({
          title: "Unavailable",
          description: "This application is not open.",
          color: COLORS.warning
        })
      ]
    })
    return
  }

  const questions = Array.isArray(config.questions) ? config.questions : []
  if (!questions.length) {
    await interaction.editReply({
      embeds: [
        systemEmbed({
          title: "No questions configured",
          description: "Staff has not configured questions for this application yet.",
          color: COLORS.warning
        })
      ]
    })
    return
  }

  const startCheck = canStartApplication({
    userId: interaction.user.id,
    guildId: interaction.guild.id,
    type
  })

  if (!startCheck.ok) {
    await interaction.editReply({
      embeds: [
        systemEmbed({
          title: "Cannot start application",
          description: startCheck.reason,
          color: COLORS.warning
        })
      ]
    })
    return
  }

  const dm = await interaction.user.createDM().catch(() => null)
  if (!dm) {
    await interaction.editReply({
      embeds: [
        systemEmbed({
          title: "DMs disabled",
          description: "Enable DMs to apply.",
          color: COLORS.error
        })
      ]
    })
    return
  }

  const session = startSession({
    userId: interaction.user.id,
    session: {
      userId: interaction.user.id,
      username: interaction.user.username,
      userTag: interaction.user.tag,
      guildId: interaction.guild.id,
      guildName: interaction.guild.name,
      type,
      config,
      questions,
      dm
    },
    onTimeout: async expiredSession => {
      await expiredSession.dm.send({
        embeds: [
          systemEmbed({
            title: "Application timed out",
            description: "No response received in time. Start /apply again when ready.",
            color: COLORS.warning
          })
        ]
      })
    }
  })

  const sent = await sendQuestion(session).then(() => true).catch(() => false)
  if (!sent) {
    cancelSession(interaction.user.id)
    await interaction.editReply({
      embeds: [
        systemEmbed({
          title: "DM unavailable",
          description: "I could not deliver your application questions in DMs.",
          color: COLORS.error
        })
      ]
    })
    return
  }

  await interaction.editReply({
    embeds: [
      systemEmbed({
        title: "Application started",
        description: "Check your DMs. Reply there to continue.",
        color: COLORS.success
      })
    ]
  })
}
