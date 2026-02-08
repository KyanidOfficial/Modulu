const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} = require("discord.js")

const { isAdmin } = require("./permissions")
const service = require("./service")
const panel = require("./panel")
const systemEmbed = require("../../messages/embeds/system.embed")
const COLORS = require("../../utils/colors")

module.exports = async interaction => {
  if (!isAdmin(interaction.member)) {
    await interaction.reply({
      embeds: [
        systemEmbed({
          title: "Access denied",
          description: "You are not allowed to manage applications.",
          color: COLORS.error
        })
      ],
      ephemeral: true
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
    const type = interaction.fields.getTextInputValue("type").trim().toLowerCase()
    const description = interaction.fields.getTextInputValue("description")

    await service.createConfig({
      guildId: interaction.guild.id,
      type,
      description
    })

    await interaction.reply({
      embeds: [
        systemEmbed({
          title: "Application created",
          description: `Application **${type}** was created.`,
          color: COLORS.success
        })
      ],
      ephemeral: true
    })
    return
  }

  /* ===============================
     LIST APPLICATIONS
     =============================== */
  if (interaction.customId === "apps:list") {
    const list = await service.listConfigs(interaction.guild.id)

    if (!list.length) {
      await interaction.reply({
        embeds: [
          systemEmbed({
            title: "No applications",
            description: "No application types exist yet.",
            color: COLORS.warning
          })
        ],
        ephemeral: true
      })
      return
    }

    const description = list
      .map(a => `- **${a.type}**`)
      .join("\n")

    await interaction.reply({
      embeds: [
        systemEmbed({
          title: "Application types",
          description,
          color: COLORS.info
        })
      ],
      ephemeral: true
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
    const type = interaction.fields.getTextInputValue("type").trim().toLowerCase()
    const key = interaction.fields.getTextInputValue("key").trim().toLowerCase()
    const prompt = interaction.fields.getTextInputValue("prompt")

    const config = await service.getConfig(interaction.guild.id, type)
    if (!config) {
      await interaction.reply({
        embeds: [
          systemEmbed({
            title: "Not found",
            description: "Application type does not exist.",
            color: COLORS.error
          })
        ],
        ephemeral: true
      })
      return
    }

    if (config.questions.some(q => q.key === key)) {
      await interaction.reply({
        embeds: [
          systemEmbed({
            title: "Duplicate key",
            description: "Question key already exists.",
            color: COLORS.warning
          })
        ],
        ephemeral: true
      })
      return
    }

    config.questions.push({
      key,
      prompt,
      kind: "paragraph",
      required: true
    })

    await service.updateConfig(interaction.guild.id, type, config)

    await interaction.reply({
      embeds: [
        systemEmbed({
          title: "Question added",
          description: `Added question **${key}**.`,
          color: COLORS.success
        })
      ],
      ephemeral: true
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
    const type = interaction.fields.getTextInputValue("type").trim().toLowerCase()

    await service.deleteConfig(interaction.guild.id, type)

    await interaction.reply({
      embeds: [
        systemEmbed({
          title: "Application deleted",
          description: `Application **${type}** was deleted.`,
          color: COLORS.success
        })
      ],
      ephemeral: true
    })
    return
  }

  /* ===============================
     FALLBACK (SAFETY)
     =============================== */
  await interaction.reply({
    embeds: [
      systemEmbed({
        title: "Unknown action",
        description: "This action is not implemented.",
        color: COLORS.error
      })
    ],
    ephemeral: true
  })
}