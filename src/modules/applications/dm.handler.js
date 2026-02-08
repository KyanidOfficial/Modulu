const db = require("../../core/database/applications")
const systemEmbed = require("../../messages/embeds/system.embed")
const applicationSubmittedEmbed = require("../../messages/embeds/application.submitted.embed")
const COLORS = require("../../utils/colors")
const {
  getSession,
  touchSession,
  saveAnswer,
  completeSession,
  cancelSession,
  setCooldown
} = require("./session.store")

const MIN_REPLY_LENGTH = 2

const sanitizeText = text => text.trim()

const buildSubmissionPayload = session => ({
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
  submittedAt: new Date().toISOString(),
  questions: session.answers,
  staffNotes: [],
  decision: null
})

const sendNextQuestion = async session => {
  const question = session.questions[session.index]
  if (!question) return false

  await session.dm.send({
    embeds: [
      systemEmbed({
        title: `Application: ${session.type}`,
        description:
          `Question ${session.index + 1} of ${session.questions.length}\n\n${question.prompt}\n\n` +
          "Reply in this DM to continue. Type `cancel` to stop.",
        color: COLORS.info
      })
    ]
  })

  return true
}

module.exports = async message => {
  if (!message.inGuild() && message.channel?.isDMBased?.()) {
    const session = getSession(message.author.id)
    if (!session) return false

    if (session.dm.id !== message.channel.id) return false

    const content = sanitizeText(message.content || "")
    if (!content) return true

    if (content.toLowerCase() === "cancel") {
      cancelSession(message.author.id)
      await message.channel.send({
        embeds: [
          systemEmbed({
            title: "Application canceled",
            description: "Your application flow has been canceled.",
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
            description: "Please provide a more complete answer.",
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

    if (!updated) return true

    touchSession(message.author.id, async expiredSession => {
      await expiredSession.dm.send({
        embeds: [
          systemEmbed({
            title: "Application timed out",
            description: "No response received in time. Start /apply again when ready.",
            color: COLORS.warning
          })
        ]
      })
    })

    const hasMoreQuestions = updated.index < updated.questions.length
    if (hasMoreQuestions) {
      const sent = await sendNextQuestion(updated).then(() => true).catch(() => false)
      if (!sent) {
        cancelSession(message.author.id)
      }
      return true
    }

    const completed = completeSession(message.author.id)
    if (!completed) return true

    const payload = buildSubmissionPayload(completed)

    const submissionId = await db.createSubmission({
      guildId: completed.guildId,
      type: completed.type,
      userId: completed.userId,
      answers: payload,
      status: "pending"
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
          submissionId
        })
      ]
    }).catch(() => {})

    return true
  }

  return false
}
