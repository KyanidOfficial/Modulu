const db = require("../../core/database/applications")
const systemEmbed = require("../../messages/embeds/system.embed")
const COLORS = require("../../utils/colors")
const {
  canStartApplication,
  startSession,
  cancelSession,
  setQuestionMessageRef
} = require("./session.store")

const log = (message, meta = {}) => {
  const parts = Object.entries(meta).map(([k, v]) => `${k}=${v}`)
  console.log(`[APPLICATIONS] ${message}${parts.length ? ` ${parts.join(" ")}` : ""}`)
}

const questionEmbed = (session, question) => {
  const requiredLabel = question.required === false ? "Optional" : "Required"
  const answerLabel = question.kind === "short" ? "short answer" : "detailed answer"

  return systemEmbed({
    title: `Application: ${session.type}`,
    description:
      `Question ${session.index + 1} of ${session.questions.length}\n` +
      `(${requiredLabel}, ${answerLabel})\n\n${question.prompt}\n\n` +
      "Reply in this DM to continue. Type `cancel` to stop.",
    color: COLORS.info
  })
}

const sendOrEditQuestionMessage = async session => {
  const question = session.questions[session.index]
  if (!question) return null

  const embed = questionEmbed(session, question)

  if (session.questionMessageId) {
    try {
      const existing = await session.dm.messages.fetch(session.questionMessageId)
      const edited = await existing.edit({ embeds: [embed] })
      log("Edited question embed", {
        userId: session.userId,
        sessionId: session.submissionId,
        messageId: edited.id,
        index: session.index
      })
      return edited
    } catch (error) {
      log("Question edit failed, falling back to send", {
        userId: session.userId,
        sessionId: session.submissionId,
        messageId: session.questionMessageId,
        reason: error?.message || "unknown"
      })
    }
  }

  const sent = await session.dm.send({ embeds: [embed] })
  setQuestionMessageRef({ userId: session.userId, channelId: session.dm.id, messageId: sent.id })
  log("Sent question embed", {
    userId: session.userId,
    sessionId: session.submissionId,
    messageId: sent.id,
    index: session.index
  })
  return sent
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

  const dm = await interaction.user.createDM().catch(error => {
    log("DM channel creation failed", {
      userId: interaction.user.id,
      reason: error?.message || "unknown"
    })
    return null
  })

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

  log("DM channel created", { userId: interaction.user.id, channelId: dm.id })

  const submissionId = await db.createSubmission({
    guildId: interaction.guild.id,
    type,
    userId: interaction.user.id,
    answers: {
      applicant: {
        id: interaction.user.id,
        username: interaction.user.username,
        tag: interaction.user.tag
      },
      guild: {
        id: interaction.guild.id,
        name: interaction.guild.name
      },
      type,
      startedAt: new Date().toISOString(),
      submittedAt: null,
      questions: [],
      staffNotes: [],
      decision: null
    },
    status: "pending"
  })

  const session = startSession({
    userId: interaction.user.id,
    session: {
      userId: interaction.user.id,
      username: interaction.user.username,
      userTag: interaction.user.tag,
      guildId: interaction.guild.id,
      guildName: interaction.guild.name,
      type,
      questions,
      dm,
      submissionId
    },
    onTimeout: async expiredSession => {
      await db.deleteSubmission(expiredSession.guildId, expiredSession.submissionId).catch(() => {})

      const timeoutEmbed = systemEmbed({
        title: "Application timed out",
        description: "No response received in time. The draft was cancelled. Start /apply again when ready.",
        color: COLORS.warning
      })

      if (expiredSession.questionMessageId) {
        try {
          const msg = await expiredSession.dm.messages.fetch(expiredSession.questionMessageId)
          await msg.edit({ embeds: [timeoutEmbed] })
          log("Timeout embed edited", { userId: expiredSession.userId, sessionId: expiredSession.submissionId })
          return
        } catch (error) {
          log("Timeout edit failed, fallback send", {
            userId: expiredSession.userId,
            sessionId: expiredSession.submissionId,
            reason: error?.message || "unknown"
          })
        }
      }

      await expiredSession.dm.send({ embeds: [timeoutEmbed] }).catch(() => {})
    }
  })

  const sent = await sendOrEditQuestionMessage(session).then(() => true).catch(error => {
    log("Initial question send failed", {
      userId: interaction.user.id,
      sessionId: submissionId,
      reason: error?.message || "unknown"
    })
    return false
  })

  if (!sent) {
    cancelSession(interaction.user.id)
    await db.deleteSubmission(interaction.guild.id, submissionId).catch(() => {})
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
