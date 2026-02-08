const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
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

const safeReply = async (interaction, payload) => {
  if (interaction.replied || interaction.deferred) {
    return interaction.editReply(payload)
  }
  return interaction.reply(payload)
}

const replySystem = (interaction, { title, description, color = COLORS.info }) =>
  safeReply(interaction, {
    embeds: [
      systemEmbed({
        title,
        description,
        color
      })
    ],
    ephemeral: true
  })

const parseModalValue = (interaction, field) =>
  interaction.fields.getTextInputValue(field) || ""

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

  /* ===============================
     CREATE APPLICATION
     =============================== */
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

  /* ===============================
     LIST APPLICATIONS
     =============================== */
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
        return `- **${a.type}** (${status})`
      })
      .join("\n")

    await replySystem(interaction, {
      title: "Application types",
      description,
      color: COLORS.info
    })
    return
  }

  /* ===============================
   ADD QUESTION
   =============================== */
  if (interaction.customId === "apps:questions") {
    const modal = new ModalBuilder()
      .setCustomId("apps:questions:add")
      .setTitle("Add Application Question")

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
          .setPlaceholder("Internal name for this question. Example: age")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("prompt")
          .setLabel("Question prompt")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
      )
    )

    await interaction.showModal(modal)
    return
  }

  if (interaction.customId === "apps:questions:add") {
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

    if (!prompt) {
      await replySystem(interaction, {
        title: "Invalid input",
        description: "Question prompt is required.",
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

    const questions = Array.isArray(config.questions) ? config.questions : []
    if (questions.some(q => normalize(q.key || "") === key)) {
      await replySystem(interaction, {
        title: "Duplicate key",
        description: "Question key already exists.",
        color: COLORS.warning
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

  /* ===============================
     DELETE APPLICATION
     =============================== */
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

  /* ===============================
     FALLBACK (SAFETY)
     =============================== */
  await replySystem(interaction, {
    title: "Unknown action",
    description: "This action is not implemented.",
    color: COLORS.error
  })
}
