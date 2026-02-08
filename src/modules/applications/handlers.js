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
const {
  normalize,
  validateType,
  validateDescription
} = require("./validators")

const APP_STATUS_LABELS = {
  pending: "Pending",
  approved: "Approved",
  denied: "Denied"
}

const safeReply = async (interaction, payload) => {
  if (interaction.replied || interaction.deferred) {
    return interaction.editReply(payload)
  }
  return interaction.reply(payload)
}

const replySystem = (interaction, { title, description, color = COLORS.info, components = [] }) =>
  safeReply(interaction, {
    embeds: [
      systemEmbed({
        title,
        description,
        color
      })
    ],
    components,
    ephemeral: true
  })

const parseModalValue = (interaction, field) =>
  interaction.fields.getTextInputValue(field) || ""

const buildSubmissionEmbed = submission => {
  const payload = submission.payload || {}
  const questions = Array.isArray(payload.questions) ? payload.questions : []
  const staffNotes = Array.isArray(payload.staffNotes) ? payload.staffNotes : []
  const submittedAt = payload.submittedAt || "Unknown"

  const embed = systemEmbed({
    title: `Application #${submission.id}`,
    description:
      `Applicant: **${payload.applicant?.username || "Unknown"}** (${submission.userId})\n` +
      `Type: **${submission.type || payload.type || "unknown"}**\n` +
      `Submitted: **${submittedAt}**\n` +
      `Status: **${APP_STATUS_LABELS[submission.status] || submission.status || "pending"}**`,
    color: COLORS.info
  })

  for (const item of questions.slice(0, 20)) {
    embed.addFields({
      name: item.prompt || item.key || "Question",
      value: item.answer || "No response",
      inline: false
    })
  }

  if (staffNotes.length) {
    embed.addFields({
      name: "Staff Notes",
      value: staffNotes
        .slice(-5)
        .map(note => `• <@${note.reviewerId}> - ${note.note}`)
        .join("\n")
        .slice(0, 1024),
      inline: false
    })
  }

  if (payload.decision) {
    embed.addFields({
      name: "Decision",
      value: `${APP_STATUS_LABELS[payload.decision.status] || payload.decision.status} by <@${payload.decision.reviewerId}>\nReason: ${payload.decision.reason || "No reason"}`,
      inline: false
    })
  }

  return embed
}

const buildReviewComponents = submissionId => [
  new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`apps:decision:approve:${submissionId}`)
      .setLabel("Approve")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`apps:decision:deny:${submissionId}`)
      .setLabel("Deny")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`apps:note:${submissionId}`)
      .setLabel("Add Staff Note")
      .setStyle(ButtonStyle.Secondary)
  )
]

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

  if (interaction.customId === "apps:create") {
    const modal = new ModalBuilder()
      .setCustomId("apps:create:modal")
      .setTitle("Create Application")

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("type")
          .setLabel("Application type")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("description")
          .setLabel("Description")
          .setStyle(TextInputStyle.Paragraph)
      )
    )

    await interaction.showModal(modal)
    return
  }

  if (interaction.customId === "apps:create:modal") {
    let type
    let description

    try {
      type = validateType(parseModalValue(interaction, "type"))
      description = validateDescription(parseModalValue(interaction, "description"))
    } catch (error) {
      await replySystem(interaction, {
        title: "Invalid input",
        description: error.message,
        color: COLORS.error
      })
      return
    }

    const existingConfig = await service.getConfig(interaction.guild.id, type)
    if (existingConfig) {
      await replySystem(interaction, {
        title: "Already exists",
        description: `Application **${type}** already exists.`,
        color: COLORS.warning
      })
      return
    }

    await service.createConfig({
      guildId: interaction.guild.id,
      type,
      description
    })

    await replySystem(interaction, {
      title: "Application created",
      description: `Application **${type}** was created.`,
      color: COLORS.success
    })
    return
  }

  if (interaction.customId === "apps:list") {
    const list = await service.listConfigs(interaction.guild.id)

    if (!list.length) {
      await replySystem(interaction, {
        title: "No applications",
        description: "No application types exist yet.",
        color: COLORS.warning
      })
      return
    }

    const description = list
      .map(a => {
        const status = a.config?.state || "unknown"
        const count = Array.isArray(a.config?.questions) ? a.config.questions.length : 0
        return `- **${a.type}** (${status}) — ${count} question(s)`
      })
      .join("\n")

    await replySystem(interaction, {
      title: "Application types",
      description,
      color: COLORS.info
    })
    return
  }

  if (interaction.customId === "apps:questions") {
    const modal = new ModalBuilder()
      .setCustomId("apps:questions:manage")
      .setTitle("Manage Questions")

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("type")
          .setLabel("Application type")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("key")
          .setLabel("Question key")
          .setPlaceholder("Example: experience")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("prompt")
          .setLabel("Prompt (leave empty to remove by key)")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
      )
    )

    await interaction.showModal(modal)
    return
  }

  if (interaction.customId === "apps:questions:manage") {
    let type

    try {
      type = validateType(parseModalValue(interaction, "type"))
    } catch (error) {
      await replySystem(interaction, {
        title: "Invalid input",
        description: error.message,
        color: COLORS.error
      })
      return
    }

    const key = normalize(parseModalValue(interaction, "key"))
    const prompt = parseModalValue(interaction, "prompt").trim()

    if (!key) {
      await replySystem(interaction, {
        title: "Invalid input",
        description: "Question key is required.",
        color: COLORS.error
      })
      return
    }

    const config = await service.getConfig(interaction.guild.id, type)
    if (!config) {
      await replySystem(interaction, {
        title: "Not found",
        description: "Application type does not exist.",
        color: COLORS.error
      })
      return
    }

    const questions = Array.isArray(config.questions) ? [...config.questions] : []
    const existingIndex = questions.findIndex(q => normalize(q.key || "") === key)

    if (!prompt) {
      if (existingIndex === -1) {
        await replySystem(interaction, {
          title: "Not found",
          description: `Question **${key}** was not found.`,
          color: COLORS.warning
        })
        return
      }

      questions.splice(existingIndex, 1)
      await service.updateConfig(interaction.guild.id, type, {
        ...config,
        questions
      })

      await replySystem(interaction, {
        title: "Question removed",
        description: `Removed question **${key}**.`,
        color: COLORS.success
      })
      return
    }

    if (existingIndex !== -1) {
      questions[existingIndex] = {
        ...questions[existingIndex],
        key,
        prompt,
        kind: "paragraph",
        required: true
      }

      await service.updateConfig(interaction.guild.id, type, {
        ...config,
        questions
      })

      await replySystem(interaction, {
        title: "Question updated",
        description: `Updated question **${key}**.`,
        color: COLORS.success
      })
      return
    }

    questions.push({
      key,
      prompt,
      kind: "paragraph",
      required: true
    })

    await service.updateConfig(interaction.guild.id, type, {
      ...config,
      questions
    })

    await replySystem(interaction, {
      title: "Question added",
      description: `Added question **${key}**.`,
      color: COLORS.success
    })
    return
  }

  if (interaction.customId === "apps:view") {
    const submissions = await service.listSubmissions(interaction.guild.id)

    if (!submissions.length) {
      await replySystem(interaction, {
        title: "List of applied",
        description: "No applications have been submitted yet.",
        color: COLORS.warning
      })
      return
    }

    const pending = submissions.filter(s => s.status === "pending").length
    const approved = submissions.filter(s => s.status === "approved").length
    const denied = submissions.filter(s => s.status === "denied").length

    const description = submissions
      .slice(0, 10)
      .map(s => `• ${s.payload?.applicant?.username || s.userId} — ${APP_STATUS_LABELS[s.status] || s.status}`)
      .join("\n")

    const select = new StringSelectMenuBuilder()
      .setCustomId("apps:view:select")
      .setPlaceholder("Choose an applicant")
      .addOptions(
        submissions.slice(0, 25).map(s => ({
          label: (s.payload?.applicant?.username || `User ${s.userId}`).slice(0, 100),
          description: `${s.type || "unknown"} • ${APP_STATUS_LABELS[s.status] || s.status}`.slice(0, 100),
          value: String(s.id)
        }))
      )

    await replySystem(interaction, {
      title: "List of applied",
      description:
        `${description}\n\nQueue stats — Pending: **${pending}**, Approved: **${approved}**, Denied: **${denied}**`,
      color: COLORS.info,
      components: [new ActionRowBuilder().addComponents(select)]
    })
    return
  }

  if (interaction.customId === "apps:view:select") {
    const submissionId = Number(interaction.values[0])
    if (!Number.isInteger(submissionId)) {
      await replySystem(interaction, {
        title: "Invalid selection",
        description: "Could not resolve that application.",
        color: COLORS.error
      })
      return
    }

    const submission = await service.getSubmission(interaction.guild.id, submissionId)
    if (!submission) {
      await replySystem(interaction, {
        title: "Not found",
        description: "That application no longer exists.",
        color: COLORS.warning
      })
      return
    }

    await safeReply(interaction, {
      embeds: [buildSubmissionEmbed(submission)],
      components: buildReviewComponents(submissionId),
      ephemeral: true
    })
    return
  }

  if (interaction.customId.startsWith("apps:decision:")) {
    const [, , action, submissionId] = interaction.customId.split(":")

    if (!["approve", "deny"].includes(action)) {
      await replySystem(interaction, {
        title: "Unknown action",
        description: "This action is not implemented.",
        color: COLORS.error
      })
      return
    }

    const modal = new ModalBuilder()
      .setCustomId(`apps:decision:modal:${action}:${submissionId}`)
      .setTitle(action === "approve" ? "Approve Application" : "Deny Application")

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("reason")
          .setLabel("Decision reason")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(action === "deny")
      )
    )

    await interaction.showModal(modal)
    return
  }

  if (interaction.customId.startsWith("apps:decision:modal:")) {
    const [, , , action, submissionIdRaw] = interaction.customId.split(":")
    const submissionId = Number(submissionIdRaw)
    const reason = parseModalValue(interaction, "reason").trim() || "No reason provided"

    if (!Number.isInteger(submissionId)) {
      await replySystem(interaction, {
        title: "Invalid submission",
        description: "Could not resolve that submission ID.",
        color: COLORS.error
      })
      return
    }

    const status = action === "approve" ? "approved" : "denied"
    const updated = await service.decideSubmission({
      guildId: interaction.guild.id,
      submissionId,
      reviewerId: interaction.user.id,
      status,
      reason
    })

    if (!updated) {
      await replySystem(interaction, {
        title: "Not found",
        description: "Application not found or could not be updated.",
        color: COLORS.warning
      })
      return
    }

    await interaction.client.users.fetch(updated.userId)
      .then(user => user.send({
        embeds: [
          systemEmbed({
            title: `Application ${APP_STATUS_LABELS[status]}`,
            description:
              `Your **${updated.type}** application in **${interaction.guild.name}** was **${status}**.\n` +
              `Reason: ${reason}`,
            color: status === "approved" ? COLORS.success : COLORS.error
          })
        ]
      }))
      .catch(() => {})

    if (interaction.channel?.isTextBased()) {
      await interaction.channel.send({
        embeds: [
          systemEmbed({
            title: "Application decision logged",
            description:
              `Submission **#${updated.id}** for <@${updated.userId}> was **${status}** by <@${interaction.user.id}>.\n` +
              `Reason: ${reason}`,
            color: COLORS.info
          })
        ]
      }).catch(() => {})
    }

    await safeReply(interaction, {
      embeds: [buildSubmissionEmbed(updated)],
      components: buildReviewComponents(updated.id),
      ephemeral: true
    })
    return
  }

  if (interaction.customId.startsWith("apps:note:")) {
    const [, , submissionId] = interaction.customId.split(":")

    const modal = new ModalBuilder()
      .setCustomId(`apps:note:modal:${submissionId}`)
      .setTitle("Add Staff Note")

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("note")
          .setLabel("Internal note")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
      )
    )

    await interaction.showModal(modal)
    return
  }

  if (interaction.customId.startsWith("apps:note:modal:")) {
    const submissionId = Number(interaction.customId.split(":")[3])
    const note = parseModalValue(interaction, "note").trim()

    if (!note) {
      await replySystem(interaction, {
        title: "Invalid note",
        description: "A note is required.",
        color: COLORS.error
      })
      return
    }

    const saved = await service.addStaffNote({
      guildId: interaction.guild.id,
      submissionId,
      reviewerId: interaction.user.id,
      note
    })

    if (!saved) {
      await replySystem(interaction, {
        title: "Not found",
        description: "Application not found.",
        color: COLORS.warning
      })
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

  if (interaction.customId === "apps:delete") {
    const modal = new ModalBuilder()
      .setCustomId("apps:delete:modal")
      .setTitle("Delete Application")

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("type")
          .setLabel("Application type to delete")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      )
    )

    await interaction.showModal(modal)
    return
  }

  if (interaction.customId === "apps:delete:modal") {
    let type

    try {
      type = validateType(parseModalValue(interaction, "type"))
    } catch (error) {
      await replySystem(interaction, {
        title: "Invalid input",
        description: error.message,
        color: COLORS.error
      })
      return
    }

    const deleted = await service.deleteConfig(interaction.guild.id, type)
    if (!deleted) {
      await replySystem(interaction, {
        title: "Not found",
        description: `Application **${type}** does not exist.`,
        color: COLORS.warning
      })
      return
    }

    await replySystem(interaction, {
      title: "Application deleted",
      description: `Application **${type}** was deleted.`,
      color: COLORS.success
    })
    return
  }

  await replySystem(interaction, {
    title: "Unknown action",
    description: "This action is not implemented.",
    color: COLORS.error
  })
}
