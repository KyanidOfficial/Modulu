const COMMAND_ENABLED = false
const { SlashCommandBuilder, PermissionsBitField, ChannelType } = require("discord.js")
const appsDb = require("../../../core/database/applications")
const systemEmbed = require("../../../messages/embeds/system.embed")
const errorEmbed = require("../../../messages/embeds/error.embed")
const COLORS = require("../../../utils/colors")

const normalizeType = value => value.trim().toLowerCase()

module.exports = {
  COMMAND_ENABLED,
  data: new SlashCommandBuilder()
    .setName("application")
    .setDescription("Configure server applications")
    .addSubcommand(sub =>
      sub.setName("type-create")
        .setDescription("Create a new application type")
        .addStringOption(o =>
          o.setName("type").setDescription("Type name").setRequired(true)
        )
        .addStringOption(o =>
          o.setName("category")
            .setDescription("Application category")
            .addChoices(
              { name: "Staff", value: "staff" },
              { name: "Community", value: "community" }
            )
        )
        .addStringOption(o =>
          o.setName("description")
            .setDescription("Description shown to applicants")
        )
    )
    .addSubcommand(sub =>
      sub.setName("type-delete")
        .setDescription("Delete an application type")
        .addStringOption(o =>
          o.setName("type").setDescription("Type name").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName("type-list")
        .setDescription("List application types for this server")
    )
    .addSubcommand(sub =>
      sub.setName("channel-set")
        .setDescription("Set the review channel for an application type")
        .addStringOption(o =>
          o.setName("type").setDescription("Type name").setRequired(true)
        )
        .addChannelOption(o =>
          o.setName("channel")
            .setDescription("Review channel")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName("question-add")
        .setDescription("Add a question to an application type")
        .addStringOption(o =>
          o.setName("type").setDescription("Type name").setRequired(true)
        )
        .addStringOption(o =>
          o.setName("key").setDescription("Unique question key").setRequired(true)
        )
        .addStringOption(o =>
          o.setName("prompt").setDescription("Question prompt").setRequired(true)
        )
        .addStringOption(o =>
          o.setName("kind")
            .setDescription("Question input type")
            .addChoices(
              { name: "Short answer", value: "short" },
              { name: "Paragraph", value: "paragraph" },
              { name: "Select", value: "select" }
            )
            .setRequired(true)
        )
        .addStringOption(o =>
          o.setName("options")
            .setDescription("Comma-separated options for select")
        )
        .addBooleanOption(o =>
          o.setName("required").setDescription("Is this required?")
        )
        .addStringOption(o =>
          o.setName("depends_on").setDescription("Question key to depend on")
        )
        .addStringOption(o =>
          o.setName("depends_value").setDescription("Value to trigger this question")
        )
    )
    .addSubcommand(sub =>
      sub.setName("question-remove")
        .setDescription("Remove a question from an application type")
        .addStringOption(o =>
          o.setName("type").setDescription("Type name").setRequired(true)
        )
        .addStringOption(o =>
          o.setName("key").setDescription("Question key").setRequired(true)
        )
    ),

  async execute(interaction) {
    const guild = interaction.guild
    if (!guild) return

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.editReply({
        embeds: [
          errorEmbed({
            users: `<@${interaction.user.id}>`,
            punishment: "application",
            state: "failed",
            reason: "Administrator permission required",
            color: COLORS.error
          })
        ]
      })
    }

    const sub = interaction.options.getSubcommand()
    const typeInput = interaction.options.getString("type")
    const type = typeInput ? normalizeType(typeInput) : null

    if (sub === "type-create") {
      const existing = await appsDb.getConfig(guild.id, type)
      if (existing) {
        return interaction.editReply({
          embeds: [systemEmbed({
            title: "Application type already exists",
            description: `The **${type}** application already exists.`,
            color: COLORS.warning
          })]
        })
      }

      const config = {
        type,
        category: interaction.options.getString("category") || "community",
        description: interaction.options.getString("description") || "No description provided.",
        reviewChannelId: null,
        questions: []
      }

      await appsDb.saveConfig(guild.id, type, config)

      return interaction.editReply({
        embeds: [systemEmbed({
          title: "Application type created",
          description: `Created **${type}** applications.`,
          color: COLORS.success
        })]
      })
    }

    if (sub === "type-delete") {
      await appsDb.deleteConfig(guild.id, type)
      return interaction.editReply({
        embeds: [systemEmbed({
          title: "Application type deleted",
          description: `Deleted **${type}** applications.`,
          color: COLORS.success
        })]
      })
    }

    if (sub === "type-list") {
      const list = await appsDb.listConfigs(guild.id)
      if (!list.length) {
        return interaction.editReply({
          embeds: [systemEmbed({
            title: "No application types",
            description: "Create one with `/application type-create`.",
            color: COLORS.warning
          })]
        })
      }

      const description = list
        .map(item => `• **${item.type}** (${item.config.category}) — ${item.config.questions.length} questions`)
        .join("\n")

      return interaction.editReply({
        embeds: [systemEmbed({
          title: "Application types",
          description,
          color: COLORS.info
        })]
      })
    }

    const config = await appsDb.getConfig(guild.id, type)
    if (!config) {
      return interaction.editReply({
        embeds: [systemEmbed({
          title: "Application type not found",
          description: `No application type named **${type}** exists.`,
          color: COLORS.warning
        })]
      })
    }

    if (sub === "channel-set") {
      const channel = interaction.options.getChannel("channel")
      config.reviewChannelId = channel.id
      await appsDb.saveConfig(guild.id, type, config)

      return interaction.editReply({
        embeds: [systemEmbed({
          title: "Review channel updated",
          description: `Applications for **${type}** will be sent to <#${channel.id}>.`,
          color: COLORS.success
        })]
      })
    }

    if (sub === "question-add") {
      const key = interaction.options.getString("key").trim().toLowerCase()
      const prompt = interaction.options.getString("prompt")
      const kind = interaction.options.getString("kind")
      const required = interaction.options.getBoolean("required") !== false
      const optionsRaw = interaction.options.getString("options") || ""
      const dependsOn = interaction.options.getString("depends_on")
      const dependsValue = interaction.options.getString("depends_value")

      if (config.questions.find(q => q.key === key)) {
        return interaction.editReply({
          embeds: [systemEmbed({
            title: "Question key already exists",
            description: `A question with key **${key}** already exists.`,
            color: COLORS.warning
          })]
        })
      }

      const options = optionsRaw
        ? optionsRaw.split(",").map(o => o.trim()).filter(Boolean)
        : []

      if (kind === "select" && options.length === 0) {
        return interaction.editReply({
          embeds: [systemEmbed({
            title: "Missing options",
            description: "Select questions require comma-separated options.",
            color: COLORS.warning
          })]
        })
      }

      config.questions.push({
        key,
        prompt,
        kind,
        required,
        options,
        dependsOn: dependsOn ? dependsOn.trim().toLowerCase() : null,
        dependsValue: dependsValue ? dependsValue.trim().toLowerCase() : null
      })

      await appsDb.saveConfig(guild.id, type, config)

      return interaction.editReply({
        embeds: [systemEmbed({
          title: "Question added",
          description: `Added question **${key}** to **${type}** applications.`,
          color: COLORS.success
        })]
      })
    }

    if (sub === "question-remove") {
      const key = interaction.options.getString("key").trim().toLowerCase()
      const before = config.questions.length
      config.questions = config.questions.filter(q => q.key !== key)
      await appsDb.saveConfig(guild.id, type, config)

      return interaction.editReply({
        embeds: [systemEmbed({
          title: "Question removed",
          description: before === config.questions.length
            ? `No question with key **${key}** was found.`
            : `Removed question **${key}** from **${type}** applications.`,
          color: before === config.questions.length ? COLORS.warning : COLORS.success
        })]
      })
    }
  }
}