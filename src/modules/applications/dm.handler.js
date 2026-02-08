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
  setCooldown,
  setQuestionMessageRef
} = require("./session.store")

const MIN_REPLY_LENGTH = 2
const MAX_REPLY_LENGTH = 1200

const log = (message, meta = {}) => {
  const parts = Object.entries(meta).map(([k, v]) => `${k}=${v}`)
  console.log(`[APPLICATIONS] ${message}${parts.length ? ` ${parts.join(" ")}` : ""}`)
}

const sanitizeText = text => (text || "").trim()

const isDmBasedChannel = channel =>
  Boolean(channel && typeof channel.isDMBased === "function" && channel.isDMBased())

const questionEmbed = session => {
  const question = session.questions[session.index]
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

const editOrSendQuestion = async session => {
  const embed = questionEmbed(session)

  if (session.questionMessageId) {
    try {
      const edited = await session.dm.messages.edit(session.questionMessageId, {
        embeds: [embed]
      })
      log("Edit embed success", {
        userId: session.userId,
        sessionId: session.submissionId,
        messageId: edited.id,
        index: session.index
      })
      return edited
    } catch (error) {
      log("Edit embed failed fallback used", {
        userId: session.userId,
        sessionId: session.submissionId,
        reason: error?.message || "unknown"
      })
    }
  }

  const sent = await session.dm.send({ embeds: [embed] })
  setQuestionMessageRef({ userId: session.userId, channelId: session.dm.id, messageId: sent.id })
  log("Edit embed failed fallback used", {
    userId: session.userId,
    sessionId: session.submissionId,
    messageId: sent.id,
    fallback: "send"
  })
  return sent
}

const editOrSendTerminal = async (session, embed, actionName) => {
  if (session?.questionMessageId) {
    try {
      const msg = await session.dm.messages.edit(session.questionMessageId, { embeds: [embed] })
      log(`${actionName} embed edited`, {
        userId: session.userId,
        sessionId: session.submissionId,
        messageId: msg.id
      })
      return
    } catch (error) {
      log(`${actionName} edit failed fallback used`, {
        userId: session.userId,
        sessionId: session.submissionId,
        reason: error?.message || "unknown"
      })
    }
  }

  const sent = await session.dm.send({ embeds: [embed] }).catch(() => null)
  if (sent) {
    setQuestionMessageRef({ userId: session.userId, channelId: session.dm.id, messageId: sent.id })
  }
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
  const isDM = isDmBasedChannel(message.channel)

  log("messageCreate observed", {
    userId: message.author?.id || "unknown",
    channelType: message.channel?.type,
    isDM
  })

  if (message.author?.bot) return false
  if (!isDM) return false

  log("DM detected", {
    userId: message.author.id,
    channelType: message.channel?.type,
    isDM
  })

  const session = getSession(message.author.id)
  if (!session) {
    log("No active session for user", { userId: message.author.id })
    return false
  }

  log("Session found", {
    userId: message.author.id,
    sessionId: session.submissionId,
    index: session.index
  })

  if (session.dmChannelId && session.dmChannelId !== message.channel.id) {
    log("DM channel mismatch", {
      userId: message.author.id,
      sessionId: session.submissionId,
      expected: session.dmChannelId,
      got: message.channel.id
    })
    return false
  }

  if (!beginProcessing(message.author.id)) {
    log("Session locked, duplicate message ignored", {
      userId: message.author.id,
      sessionId: session.submissionId
    })
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
      log("Cancel detected", {
        userId: message.author.id,
        sessionId: session.submissionId
      })

      const closed = cancelSession(message.author.id)
      if (closed) {
        await db.deleteSubmission(closed.guildId, closed.submissionId).catch(() => {})
        const cancelEmbed = systemEmbed({
          title: "Application canceled",
          description: "Your application session has been canceled and cleaned up.",
          color: COLORS.warning
        })
        await editOrSendTerminal(closed, cancelEmbed, "Cancel")
      }

      log("Session cleared", {
        userId: message.author.id,
        sessionId: session.submissionId
      })
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

    const beforeIndex = session.index
    const updated = saveAnswer({ userId: message.author.id, answer: content })

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
      log("Session cleared", {
        userId: message.author.id,
        sessionId: session.submissionId,
        reason: "sync_error"
      })
      return true
    }

    log("Answer accepted", {
      userId: message.author.id,
      sessionId: updated.submissionId,
      index: beforeIndex,
      length: content.length
    })

    await persistDraft(updated)
    touchSession(message.author.id)

    const hasMoreQuestions = updated.index < updated.questions.length
    if (hasMoreQuestions) {
      log("Advancing question index", {
        userId: updated.userId,
        sessionId: updated.submissionId,
        from: beforeIndex,
        to: updated.index
      })

      const sent = await editOrSendQuestion(updated).then(() => true).catch(error => {
        log("Failed to send/edit next question", {
          userId: updated.userId,
          sessionId: updated.submissionId,
          reason: error?.message || "unknown"
        })
        return false
      })

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

    const submittedEmbed = applicationSubmittedEmbed({
      type: completed.type,
      guild: completed.guildName,
      submissionId: completed.submissionId
    })

    await editOrSendTerminal(completed, submittedEmbed, "Completion")

    log("Session finalized", {
      userId: completed.userId,
      sessionId: completed.submissionId
    })

    return true
  } catch (error) {
    log("DM handler failure", {
      userId: message.author?.id || "unknown",
      sessionId: session?.submissionId || "none",
      reason: error?.message || "unknown"
    })
    return true
  } finally {
    endProcessing(message.author.id)
  }
}
