const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js")

const { isAdmin } = require("./permissions")
const service = require("./service")
const systemEmbed = require("../../messages/embeds/system.embed")
const COLORS = require("../../utils/colors")
const { normalize, validateType, validateDescription } = require("./validators")

const APP_STATUS_LABELS = {
  pending: "Pending",
  approved: "Approved",
  denied: "Denied"
}

const safeReply = async (interaction, payload) => {
  if (interaction.replied || interaction.deferred) return interaction.editReply(payload)
  return interaction.reply(payload)
}

const replySystem = (interaction, { title, description, color = COLORS.info, components = [] }) =>
  safeReply(interaction, {
    embeds: [systemEmbed({ title, description, color })],
    components,
    ephemeral: true
  })

const parseModalValue = (interaction, field) => interaction.fields.getTextInputValue(field) || ""

const supportsModal = interaction =>
  typeof interaction.showModal === "function" &&
  (interaction.isButton?.() || interaction.isChatInputCommand?.())

const showModalOrError = async (interaction, modal) => {
  if (!supportsModal(interaction)) {
    await replySystem(interaction, {
      title: "Action unavailable",
      description: "This interaction cannot open a modal. Please try again from the command panel.",
      color: COLORS.error
    })
    return false
  }

  await interaction.showModal(modal)
  return true
}

const getQuestionPreview = questions => {
  if (!questions.length) return "No questions yet."

  return questions
    .map((q, index) => {
      const req = q.required === false ? "optional" : "required"
      const kind = q.kind === "short" ? "short" : "paragraph"
      return `${index + 1}. **${q.prompt}** (${req}, ${kind})`
    })
    .join("\n")
    .slice(0, 3500)
}

const buildQuestionEditorComponents = (type, questions) => [
  new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`apps:q:add:${type}`).setLabel("Add").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`apps:q:edit:${type}`).setLabel("Edit").setStyle(ButtonStyle.Primary).setDisabled(!questions.length),
    new ButtonBuilder().setCustomId(`apps:q:remove:${type}`).setLabel("Remove").setStyle(ButtonStyle.Danger).setDisabled(!questions.length),
    new ButtonBuilder().setCustomId(`apps:q:reorder:${type}`).setLabel("Reorder").setStyle(ButtonStyle.Secondary).setDisabled(questions.length < 2)
  )
]

const buildSubmissionEmbed = submission => {
  const payload = submission.payload || {}
  const questions = Array.isArray(payload.questions) ? payload.questions : []
  const embed = systemEmbed({
    title: `Submission #${submission.id}`,
    description:
      `Applicant: **${payload.applicant?.username || submission.userId}** (${submission.userId})\n` +
      `Type: **${submission.type || payload.type || "unknown"}**\n` +
      `Status: **${APP_STATUS_LABELS[submission.status] || submission.status || "pending"}**\n` +
      `Submitted: **${payload.submittedAt || "In progress"}**`,
    color: COLORS.info
  })

  for (const item of questions.slice(0, 20)) {
    embed.addFields({ name: item.prompt || "Question", value: item.answer || "No response", inline: false })
  }

  const notes = Array.isArray(payload.staffNotes) ? payload.staffNotes : []
  if (notes.length) {
    embed.addFields({
      name: "Staff Notes",
      value: notes.slice(-5).map(note => `• <@${note.reviewerId}>: ${note.note}`).join("\n").slice(0, 1024),
      inline: false
    })
  }

  return embed
}

const buildReviewComponents = submissionId => [
  new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`apps:decision:approve:${submissionId}`).setLabel("Approve").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`apps:decision:deny:${submissionId}`).setLabel("Deny").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`apps:note:${submissionId}`).setLabel("Add Staff Note").setStyle(ButtonStyle.Secondary)
  )
]

const parsePage = customId => {
  const parts = customId.split(":")
  const page = Number(parts[2] || 0)
  return Number.isInteger(page) && page >= 0 ? page : 0
}

const renderSubmissionList = async (interaction, page = 0) => {
  const submissions = await service.listSubmissions(interaction.guild.id)
  if (!submissions.length) {
    await replySystem(interaction, { title: "View Submissions", description: "No submissions found.", color: COLORS.warning })
    return
  }

  const pageSize = 25
  const maxPage = Math.max(0, Math.ceil(submissions.length / pageSize) - 1)
  const currentPage = Math.min(page, maxPage)
  const start = currentPage * pageSize
  const currentItems = submissions.slice(start, start + pageSize)

  if (!currentItems.length) {
    await replySystem(interaction, { title: "View Submissions", description: "No submissions on this page.", color: COLORS.warning })
    return
  }

  const description = currentItems
    .slice(0, 10)
    .map(s => `• ${s.payload?.applicant?.username || s.userId} — ${APP_STATUS_LABELS[s.status] || s.status} — ${s.payload?.submittedAt || "In progress"}`)
    .join("\n")

  const components = []

  const options = currentItems.slice(0, 25).map(s => ({
    label: (s.payload?.applicant?.username || `User ${s.userId}`).slice(0, 100),
    description: `${s.type || "unknown"} • ${APP_STATUS_LABELS[s.status] || s.status}`.slice(0, 100),
    value: String(s.id)
  }))

  if (options.length > 0) {
    components.push(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("apps:submissions:select")
          .setPlaceholder("Select a submission")
          .addOptions(options)
      )
    )
  }

  if (maxPage > 0) {
    components.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`apps:submissions:${currentPage - 1}`)
          .setLabel("Previous")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(currentPage === 0),
        new ButtonBuilder()
          .setCustomId(`apps:submissions:${currentPage + 1}`)
          .setLabel("Next")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(currentPage >= maxPage)
      )
    )
  }

  await replySystem(interaction, {
    title: "View Submissions",
    description: `${description}\n\nPage ${currentPage + 1}/${maxPage + 1}`,
    components
  })
}

module.exports = async interaction => {
  if (!interaction.inGuild() || !interaction.guild || !interaction.member) {
    await replySystem(interaction, {
      title: "Unavailable",
      description: "Application management is only available in a server.",
      color: COLORS.warning
    })
    return
  }

  if (!isAdmin(interaction.member)) {
    await replySystem(interaction, {
      title: "Access denied",
      description: "You are not allowed to manage applications.",
      color: COLORS.error
    })
    return
  }

  // MODALS (check first to avoid prefix collisions)
  if (interaction.customId === "apps:create:modal") {
    try {
      const type = validateType(parseModalValue(interaction, "type"))
      const description = validateDescription(parseModalValue(interaction, "description"))

      const existingConfig = await service.getConfig(interaction.guild.id, type)
      if (existingConfig) {
        await replySystem(interaction, { title: "Already exists", description: `Application **${type}** already exists.`, color: COLORS.warning })
        return
      }

      await service.createConfig({ guildId: interaction.guild.id, type, description, creatorId: interaction.user.id })
      await replySystem(interaction, { title: "Type created", description: `Application **${type}** was created.`, color: COLORS.success })
    } catch (error) {
      await replySystem(interaction, { title: "Invalid input", description: error.message, color: COLORS.error })
    }
    return
  }

  if (interaction.customId.startsWith("apps:q:add:modal:")) {
    const type = interaction.customId.split(":")[4]
    const config = await service.getConfig(interaction.guild.id, type)
    if (!config) {
      await replySystem(interaction, { title: "Not found", description: "Type no longer exists.", color: COLORS.warning })
      return
    }

    const prompt = parseModalValue(interaction, "prompt").trim()
    if (!prompt) {
      await replySystem(interaction, { title: "Invalid input", description: "Question prompt is required.", color: COLORS.error })
      return
    }

    const kind = normalize(parseModalValue(interaction, "kind")) === "short" ? "short" : "paragraph"
    const requiredInput = normalize(parseModalValue(interaction, "required"))
    const required = !["no", "false", "optional", "0"].includes(requiredInput)

    const questions = Array.isArray(config.questions) ? [...config.questions] : []
    questions.push({ key: `q${questions.length + 1}`, prompt, kind, required })

    await service.updateConfig(interaction.guild.id, type, { ...config, questions })
    await replySystem(interaction, {
      title: `Question editor: ${type}`,
      description: getQuestionPreview(questions),
      components: buildQuestionEditorComponents(type, questions),
      color: COLORS.success
    })
    return
  }

  if (interaction.customId.startsWith("apps:q:edit:modal:")) {
    const [, , , , type, indexRaw] = interaction.customId.split(":")
    const index = Number(indexRaw)
    const config = await service.getConfig(interaction.guild.id, type)
    const questions = Array.isArray(config?.questions) ? [...config.questions] : []

    if (!questions[index]) {
      await replySystem(interaction, { title: "Not found", description: "Question no longer exists.", color: COLORS.warning })
      return
    }

    const prompt = parseModalValue(interaction, "prompt").trim()
    if (!prompt) {
      await replySystem(interaction, { title: "Invalid input", description: "Question prompt is required.", color: COLORS.error })
      return
    }

    const kind = normalize(parseModalValue(interaction, "kind")) === "short" ? "short" : "paragraph"
    const requiredInput = normalize(parseModalValue(interaction, "required"))
    const required = !["no", "false", "optional", "0"].includes(requiredInput)

    questions[index] = { ...questions[index], prompt, kind, required }

    await service.updateConfig(interaction.guild.id, type, { ...config, questions })
    await replySystem(interaction, {
      title: `Question editor: ${type}`,
      description: getQuestionPreview(questions),
      components: buildQuestionEditorComponents(type, questions),
      color: COLORS.success
    })
    return
  }

  if (interaction.customId.startsWith("apps:q:reorder:modal:")) {
    const type = interaction.customId.split(":")[4]
    const from = Number(parseModalValue(interaction, "from")) - 1
    const to = Number(parseModalValue(interaction, "to")) - 1

    const config = await service.getConfig(interaction.guild.id, type)
    const questions = Array.isArray(config?.questions) ? [...config.questions] : []
    if (!questions[from] || to < 0 || to >= questions.length) {
      await replySystem(interaction, { title: "Invalid positions", description: "Please enter valid positions.", color: COLORS.error })
      return
    }

    const [moved] = questions.splice(from, 1)
    questions.splice(to, 0, moved)

    await service.updateConfig(interaction.guild.id, type, {
      ...config,
      questions: questions.map((q, i) => ({ ...q, key: `q${i + 1}` }))
    })

    await replySystem(interaction, {
      title: `Question editor: ${type}`,
      description: getQuestionPreview(questions),
      components: buildQuestionEditorComponents(type, questions),
      color: COLORS.success
    })
    return
  }

  if (interaction.customId.startsWith("apps:decision:modal:")) {
    const [, , , action, submissionIdRaw] = interaction.customId.split(":")
    const submissionId = Number(submissionIdRaw)
    const reason = parseModalValue(interaction, "reason").trim() || "No reason provided"
    const status = action === "approve" ? "approved" : "denied"

    const updated = await service.decideSubmission({
      guildId: interaction.guild.id,
      submissionId,
      reviewerId: interaction.user.id,
      status,
      reason
    })

    if (!updated) {
      await replySystem(interaction, { title: "Not found", description: "Submission not found.", color: COLORS.warning })
      return
    }

    await interaction.client.users.fetch(updated.userId)
      .then(user => user.send({
        embeds: [
          systemEmbed({
            title: `Application ${APP_STATUS_LABELS[status]}`,
            description: `Your **${updated.type}** application in **${interaction.guild.name}** was **${status}**.\nReason: ${reason}`,
            color: status === "approved" ? COLORS.success : COLORS.error
          })
        ]
      }))
      .catch(() => {})

    await safeReply(interaction, {
      embeds: [buildSubmissionEmbed(updated)],
      components: buildReviewComponents(updated.id),
      ephemeral: true
    })
    return
  }

  if (interaction.customId.startsWith("apps:note:modal:")) {
    const submissionId = Number(interaction.customId.split(":")[3])
    const note = parseModalValue(interaction, "note").trim()

    if (!note) {
      await replySystem(interaction, { title: "Invalid note", description: "A note is required.", color: COLORS.error })
      return
    }

    const saved = await service.addStaffNote({ guildId: interaction.guild.id, submissionId, reviewerId: interaction.user.id, note })
    if (!saved) {
      await replySystem(interaction, { title: "Not found", description: "Submission not found.", color: COLORS.warning })
      return
    }

    const submission = await service.getSubmission(interaction.guild.id, submissionId)
    await safeReply(interaction, {
      embeds: [buildSubmissionEmbed(submission)],
      components: buildReviewComponents(submissionId),
      ephemeral: true
    })
    return
  }

  if (interaction.customId === "apps:delete:modal") {
    try {
      const type = validateType(parseModalValue(interaction, "type"))
      const deleted = await service.deleteConfig(interaction.guild.id, type)
      if (!deleted) {
        await replySystem(interaction, { title: "Not found", description: `Application **${type}** does not exist.`, color: COLORS.warning })
        return
      }

      await replySystem(interaction, { title: "Application deleted", description: `Application **${type}** was deleted.`, color: COLORS.success })
    } catch (error) {
      await replySystem(interaction, { title: "Invalid input", description: error.message, color: COLORS.error })
    }
    return
  }

  // BUTTONS & SELECTS
  if (interaction.customId === "apps:create") {
    const modal = new ModalBuilder().setCustomId("apps:create:modal").setTitle("Create Application Type")
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("type").setLabel("Application type").setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("description").setLabel("Description").setStyle(TextInputStyle.Paragraph))
    )
    await showModalOrError(interaction, modal)
    return
  }

  if (interaction.customId === "apps:list") {
    const list = await service.listConfigs(interaction.guild.id)
    if (!list.length) {
      await replySystem(interaction, { title: "No applications", description: "No application types exist yet.", color: COLORS.warning })
      return
    }

    const description = list.map(a => `- **${a.type}** (${a.config?.state || "unknown"})`).join("\n")
    await replySystem(interaction, { title: "Application types", description, color: COLORS.info })
    return
  }

  if (interaction.customId === "apps:applications") {
    await replySystem(interaction, {
      title: "View Applications",
      description: "Choose a filter to list application types.",
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("apps:applications:all").setLabel("All applications").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("apps:applications:mine").setLabel("Only my applications").setStyle(ButtonStyle.Secondary)
        )
      ]
    })
    return
  }

  if (interaction.customId === "apps:applications:all" || interaction.customId === "apps:applications:mine") {
    const list = await service.listConfigs(interaction.guild.id)
    const filtered = interaction.customId.endsWith(":mine")
      ? list.filter(item => item.config?.creatorId === interaction.user.id)
      : list

    if (!filtered.length) {
      await replySystem(interaction, {
        title: "View Applications",
        description: interaction.customId.endsWith(":mine") ? "You have not created any application types." : "No application types found.",
        color: COLORS.warning
      })
      return
    }

    const description = filtered
      .map(item => {
        const qCount = Array.isArray(item.config?.questions) ? item.config.questions.length : 0
        return `• **${item.type}** — creator: <@${item.config?.creatorId || "unknown"}> — ${item.config?.state || "unknown"} — ${qCount} question(s) — created ${item.config?.createdAt || "unknown"}`
      })
      .join("\n")
      .slice(0, 3900)

    await replySystem(interaction, { title: "Application Types", description, color: COLORS.info })
    return
  }

  if (interaction.customId === "apps:submissions") {
    await renderSubmissionList(interaction, 0)
    return
  }

  if (/^apps:submissions:\d+$/.test(interaction.customId)) {
    await renderSubmissionList(interaction, parsePage(interaction.customId))
    return
  }

  if (interaction.customId === "apps:submissions:select") {
    const submissionId = Number(interaction.values?.[0])
    if (!Number.isInteger(submissionId)) {
      await replySystem(interaction, { title: "Invalid selection", description: "Could not resolve that submission.", color: COLORS.error })
      return
    }

    const submission = await service.getSubmission(interaction.guild.id, submissionId)
    if (!submission) {
      await replySystem(interaction, { title: "Not found", description: "Submission not found.", color: COLORS.warning })
      return
    }

    await safeReply(interaction, {
      embeds: [buildSubmissionEmbed(submission)],
      components: buildReviewComponents(submissionId),
      ephemeral: true
    })
    return
  }

  if (interaction.customId === "apps:questions") {
    const list = await service.listConfigs(interaction.guild.id)
    if (!list.length) {
      await replySystem(interaction, { title: "Question editor", description: "Create an application type first.", color: COLORS.warning })
      return
    }

    const options = list.slice(0, 25).map(item => ({
      label: item.type.slice(0, 100),
      description: `${Array.isArray(item.config?.questions) ? item.config.questions.length : 0} question(s)`.slice(0, 100),
      value: item.type
    }))

    if (!options.length) {
      await replySystem(interaction, { title: "Question editor", description: "No application types available.", color: COLORS.warning })
      return
    }

    await replySystem(interaction, {
      title: "Question editor",
      description: "Select a type to add, edit, reorder, remove, and preview questions.",
      components: [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder().setCustomId("apps:q:type").setPlaceholder("Select an application type").addOptions(options)
        )
      ]
    })
    return
  }

  if (interaction.customId === "apps:q:type") {
    const type = interaction.values?.[0]
    const config = await service.getConfig(interaction.guild.id, type)
    if (!config) {
      await replySystem(interaction, { title: "Not found", description: "Type no longer exists.", color: COLORS.warning })
      return
    }

    const questions = Array.isArray(config.questions) ? config.questions : []
    await replySystem(interaction, {
      title: `Question editor: ${type}`,
      description: getQuestionPreview(questions),
      components: buildQuestionEditorComponents(type, questions)
    })
    return
  }

  if (/^apps:q:add:[^:]+$/.test(interaction.customId)) {
    const type = interaction.customId.split(":")[3]
    const modal = new ModalBuilder().setCustomId(`apps:q:add:modal:${type}`).setTitle("Add Question")
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("prompt").setLabel("Question prompt").setStyle(TextInputStyle.Paragraph).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("kind").setLabel("Answer type (short/paragraph)").setStyle(TextInputStyle.Short).setRequired(true).setValue("paragraph")),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("required").setLabel("Required? (yes/no)").setStyle(TextInputStyle.Short).setRequired(true).setValue("yes"))
    )

    await showModalOrError(interaction, modal)
    return
  }

  if (/^apps:q:edit:[^:]+$/.test(interaction.customId)) {
    const type = interaction.customId.split(":")[3]
    const config = await service.getConfig(interaction.guild.id, type)
    const questions = Array.isArray(config?.questions) ? config.questions : []

    if (!questions.length) {
      await replySystem(interaction, { title: "Question editor", description: "No questions to edit.", color: COLORS.warning })
      return
    }

    const options = questions.slice(0, 25).map((q, i) => ({ label: `#${i + 1} ${q.prompt}`.slice(0, 100), value: String(i) }))
    await replySystem(interaction, {
      title: `Edit question: ${type}`,
      description: "Pick a question.",
      components: [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder().setCustomId(`apps:q:edit:select:${type}`).setPlaceholder("Select a question to edit").addOptions(options)
        )
      ]
    })
    return
  }

  if (interaction.customId.startsWith("apps:q:edit:select:")) {
    const type = interaction.customId.split(":")[4]
    const index = Number(interaction.values?.[0])
    const modal = new ModalBuilder().setCustomId(`apps:q:edit:modal:${type}:${index}`).setTitle("Edit Question")

    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("prompt").setLabel("Question prompt").setStyle(TextInputStyle.Paragraph).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("kind").setLabel("Answer type (short/paragraph)").setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("required").setLabel("Required? (yes/no)").setStyle(TextInputStyle.Short).setRequired(true))
    )

    await showModalOrError(interaction, modal)
    return
  }

  if (/^apps:q:remove:[^:]+$/.test(interaction.customId)) {
    const type = interaction.customId.split(":")[3]
    const config = await service.getConfig(interaction.guild.id, type)
    const questions = Array.isArray(config?.questions) ? config.questions : []

    if (!questions.length) {
      await replySystem(interaction, { title: "Question editor", description: "No questions to remove.", color: COLORS.warning })
      return
    }

    const options = questions.slice(0, 25).map((q, i) => ({ label: `#${i + 1} ${q.prompt}`.slice(0, 100), value: String(i) }))
    await replySystem(interaction, {
      title: `Remove question: ${type}`,
      description: "Pick a question.",
      components: [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder().setCustomId(`apps:q:remove:select:${type}`).setPlaceholder("Select a question to remove").addOptions(options)
        )
      ]
    })
    return
  }

  if (interaction.customId.startsWith("apps:q:remove:select:")) {
    const type = interaction.customId.split(":")[4]
    const index = Number(interaction.values?.[0])
    const config = await service.getConfig(interaction.guild.id, type)
    const questions = Array.isArray(config?.questions) ? [...config.questions] : []

    if (!questions[index]) {
      await replySystem(interaction, { title: "Not found", description: "Question no longer exists.", color: COLORS.warning })
      return
    }

    questions.splice(index, 1)
    await service.updateConfig(interaction.guild.id, type, {
      ...config,
      questions: questions.map((q, i) => ({ ...q, key: `q${i + 1}` }))
    })

    await replySystem(interaction, {
      title: `Question editor: ${type}`,
      description: getQuestionPreview(questions),
      components: buildQuestionEditorComponents(type, questions),
      color: COLORS.success
    })
    return
  }

  if (/^apps:q:reorder:[^:]+$/.test(interaction.customId)) {
    const type = interaction.customId.split(":")[3]
    const modal = new ModalBuilder().setCustomId(`apps:q:reorder:modal:${type}`).setTitle("Reorder Questions")
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("from").setLabel("Move question from position").setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("to").setLabel("Move question to position").setStyle(TextInputStyle.Short).setRequired(true))
    )

    await showModalOrError(interaction, modal)
    return
  }

  if (/^apps:decision:approve:\d+$/.test(interaction.customId) || /^apps:decision:deny:\d+$/.test(interaction.customId)) {
    const [, , action, submissionId] = interaction.customId.split(":")
    const modal = new ModalBuilder()
      .setCustomId(`apps:decision:modal:${action}:${submissionId}`)
      .setTitle(action === "approve" ? "Approve Submission" : "Deny Submission")

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("reason").setLabel("Decision reason").setStyle(TextInputStyle.Paragraph).setRequired(action === "deny")
      )
    )

    await showModalOrError(interaction, modal)
    return
  }

  if (/^apps:note:\d+$/.test(interaction.customId)) {
    const submissionId = interaction.customId.split(":")[2]
    const modal = new ModalBuilder().setCustomId(`apps:note:modal:${submissionId}`).setTitle("Add Staff Note")
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("note").setLabel("Internal note").setStyle(TextInputStyle.Paragraph).setRequired(true)
      )
    )

    await showModalOrError(interaction, modal)
    return
  }

  if (interaction.customId === "apps:delete") {
    const modal = new ModalBuilder().setCustomId("apps:delete:modal").setTitle("Delete Application Type")
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("type").setLabel("Application type to delete").setStyle(TextInputStyle.Short).setRequired(true)
      )
    )

    await showModalOrError(interaction, modal)
    return
  }

  await replySystem(interaction, {
    title: "Unknown action",
    description: "This action is not implemented.",
    color: COLORS.error
  })
}
