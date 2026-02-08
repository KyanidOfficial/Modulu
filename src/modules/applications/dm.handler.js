const db = require("../../core/database/applications")
const systemEmbed = require("../../messages/embeds/system.embed")
const applicationSubmittedEmbed = require("../../messages/embeds/application.submitted.embed")
const COLORS = require("../../utils/colors")
const {
  getSession,
  touchSession,
  beginProcessing,
  endProcessing,
  saveAnswer,
  completeSession,
  cancelSession,
  setCooldown
} = require("./session.store")

const MIN_REPLY_LENGTH = 2
const MAX_REPLY_LENGTH = 1200

const sanitizeText = text => (text || "").trim()

const sendQuestion = async session => {
  const question = session.questions[session.index]
  if (!question) return false

  const requiredLabel = question.required === false ? "Optional" : "Required"
  const answerLabel = question.kind === "short" ? "short answer" : "detailed answer"

  await session.dm.send({
    embeds: [
      systemEmbed({
        title: `Application: ${session.type}`,
        description:
          `Question ${session.index + 1} of ${session.questions.length}\n` +
          `(${requiredLabel}, ${answerLabel})\n\n${question.prompt}\n\n` +
          "Reply in this DM to continue. Type `cancel` to stop.",
        color: COLORS.info
      })
    ]
  })

  return true
}

const persistDraft = async session => {
  await db.saveSubmission(session.guildId, session.submissionId, {
    status: "pending",
    payload: {
      applicant: {
        id: session.userId,
        username: session.username,
        tag: session.userTag
      },
      guild: {
        id: session.guildId,
        name: session.guildName
      },
      type: session.type,
      startedAt: new Date(session.startedAt).toISOString(),
      submittedAt: null,
      questions: session.answers,
      staffNotes: [],
      decision: null
    }
  })
}

module.exports = async message => {
  if (message.author?.bot) return false
  if (!message.channel?.isDMBased?.()) return false

  const session = getSession(message.author.id)
  if (!session) return false

  if (session.dm.id !== message.channel.id) return false

  if (!beginProcessing(message.author.id)) {
    return true
  }

  try {
    const content = sanitizeText(message.content)

    if (!content) {
      await message.channel.send({
        embeds: [
          systemEmbed({
            title: "Empty answer",
            description: "Please send a message with your answer, or type `cancel`.",
            color: COLORS.warning
          })
        ]
      }).catch(() => {})
      return true
    }

    if (content.toLowerCase() === "cancel") {
      const closed = cancelSession(message.author.id)
      if (closed) {
        await db.deleteSubmission(closed.guildId, closed.submissionId).catch(() => {})
      }
      await message.channel.send({
        embeds: [
          systemEmbed({
            title: "Application canceled",
            description: "Your application session has been canceled and cleaned up.",
            color: COLORS.warning
          })
        ]
      }).catch(() => {})
      return true
    }

    if (content.length < MIN_REPLY_LENGTH) {
      await message.channel.send({
        embeds: [
          systemEmbed({
            title: "Answer too short",
            description: "Please provide at least 2 characters.",
            color: COLORS.warning
          })
        ]
      }).catch(() => {})
      return true
    }

    if (content.length > MAX_REPLY_LENGTH) {
      await message.channel.send({
        embeds: [
          systemEmbed({
            title: "Answer too long",
            description: "Please keep answers under 1200 characters.",
            color: COLORS.warning
          })
        ]
      }).catch(() => {})
      return true
    }

    const updated = saveAnswer({
      userId: message.author.id,
      answer: content
    })

    if (!updated) {
      await message.channel.send({
        embeds: [
          systemEmbed({
            title: "Session error",
            description: "Your session is out of sync. Please run /apply again.",
            color: COLORS.error
          })
        ]
      }).catch(() => {})
      cancelSession(message.author.id)
      return true
    }

    await persistDraft(updated)
    touchSession(message.author.id)

    const hasMoreQuestions = updated.index < updated.questions.length
    if (hasMoreQuestions) {
      const sent = await sendQuestion(updated).then(() => true).catch(() => false)
      if (!sent) {
        const closed = cancelSession(message.author.id)
        if (closed) {
          await db.deleteSubmission(closed.guildId, closed.submissionId).catch(() => {})
        }
      }
      return true
    }

    const completed = completeSession(message.author.id)
    if (!completed) return true

    const payload = {
      applicant: {
        id: completed.userId,
        username: completed.username,
        tag: completed.userTag
      },
      guild: {
        id: completed.guildId,
        name: completed.guildName
      },
      type: completed.type,
      startedAt: new Date(completed.startedAt).toISOString(),
      submittedAt: new Date().toISOString(),
      questions: completed.answers,
      staffNotes: [],
      decision: null
    }

    await db.saveSubmission(completed.guildId, completed.submissionId, {
      status: "pending",
      payload
    })

    setCooldown({
      userId: completed.userId,
      guildId: completed.guildId,
      type: completed.type
    })

    await message.channel.send({
      embeds: [
        applicationSubmittedEmbed({
          type: completed.type,
          guild: completed.guildName,
          submissionId: completed.submissionId
        })
      ]
    }).catch(() => {})

    return true
  } finally {
    endProcessing(message.author.id)
  }
}
