const {
  ModalBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js")

const db = require("../../core/database/applications")
const systemEmbed = require("../../messages/embeds/system.embed")
const COLORS = require("../../shared/utils/colors")
const { createSession, getSession } = require("./modalApply.store")

const QUESTIONS_PER_MODAL = 5

const chunkQuestions = (questions, step) =>
  questions.slice(step * QUESTIONS_PER_MODAL, (step + 1) * QUESTIONS_PER_MODAL)

const buildQuestionInput = (question, globalIndex) => {
  const kind = question.kind === "short" ? TextInputStyle.Short : TextInputStyle.Paragraph

  const input = new TextInputBuilder()
    .setCustomId(`q_${globalIndex}`)
    .setLabel((question.prompt || `Question ${globalIndex + 1}`).slice(0, 45))
    .setRequired(question.required !== false)
    .setStyle(kind)

  const placeholder = question.placeholder || question.description || "Enter your answer"
  if (placeholder) input.setPlaceholder(String(placeholder).slice(0, 100))

  const minLength = Number.isInteger(question.minLength) ? Math.max(0, Math.min(question.minLength, 4000)) : null
  const maxLength = Number.isInteger(question.maxLength) ? Math.max(1, Math.min(question.maxLength, 4000)) : null

  if (minLength !== null) input.setMinLength(minLength)
  if (maxLength !== null) input.setMaxLength(maxLength)

  return input
}

const buildApplyModal = ({ session, step }) => {
  const modal = new ModalBuilder()
    .setCustomId(`apps:apply:step:${session.submissionId}:${step}`)
    .setTitle(`Apply: ${session.type} (${step + 1}/${session.totalSteps})`)

  const questions = chunkQuestions(session.questions, step)
  questions.forEach((question, offset) => {
    const globalIndex = step * QUESTIONS_PER_MODAL + offset
    modal.addComponents(new ActionRowBuilder().addComponents(buildQuestionInput(question, globalIndex)))
  })

  return modal
}

module.exports = async interaction => {
  if (!interaction.inGuild() || !interaction.guild) {
    await interaction.reply({
      embeds: [
        systemEmbed({
          title: "Unavailable",
          description: "Applications can only be started from a server.",
          color: COLORS.warning
        })
      ],
      ephemeral: true
    })
    return
  }

  const type = interaction.options.getString("type").trim().toLowerCase()
  const config = await db.getConfig(interaction.guild.id, type)

  if (!config || config.state !== "open") {
    await interaction.reply({
      embeds: [
        systemEmbed({
          title: "Unavailable",
          description: "This application is not open.",
          color: COLORS.warning
        })
      ],
      ephemeral: true
    })
    return
  }

  const questions = Array.isArray(config.questions) ? config.questions : []
  if (!questions.length) {
    await interaction.reply({
      embeds: [
        systemEmbed({
          title: "No questions configured",
          description: "This application type has no questions yet.",
          color: COLORS.warning
        })
      ],
      ephemeral: true
    })
    return
  }

  const existing = getSession({ guildId: interaction.guild.id, userId: interaction.user.id })
  if (existing) {
    await interaction.reply({
      embeds: [
        systemEmbed({
          title: "Application in progress",
          description: "You already have an active application flow in progress.",
          color: COLORS.warning
        })
      ],
      ephemeral: true
    })
    return
  }

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

  const totalSteps = Math.ceil(questions.length / QUESTIONS_PER_MODAL)
  const session = createSession({
    submissionId,
    guildId: interaction.guild.id,
    userId: interaction.user.id,
    username: interaction.user.username,
    userTag: interaction.user.tag,
    type,
    questions,
    step: 0,
    totalSteps,
    answers: []
  })

  const modal = buildApplyModal({ session, step: 0 })
  await interaction.showModal(modal)
}
