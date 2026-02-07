const COMMAND_ENABLED = false
const { SlashCommandBuilder } = require("discord.js")
const appsDb = require("../../../core/database/applications")
const systemEmbed = require("../../../messages/embeds/system.embed")
const submittedEmbed = require("../../../messages/embeds/application.submitted.embed")
const reviewEmbed = require("../../../messages/embeds/application.review.embed")
const COLORS = require("../../../utils/colors")

const normalize = value => value?.trim().toLowerCase()

const shouldAsk = (question, answersMap) => {
  if (!question.dependsOn) return true
  const targetValue = normalize(answersMap[question.dependsOn])
  const requiredValue = normalize(question.dependsValue)
  return targetValue === requiredValue
}

const askQuestion = async (channel, question, index, total) => {
  const optionsLine = question.kind === "select" && question.options?.length
    ? `\n\nOptions: ${question.options.join(", ")}`
    : ""
  const skipLine = question.required ? "" : "\nType `skip` to skip this question."

  await channel.send({
    embeds: [
      systemEmbed({
        title: `Question ${index + 1} of ${total}`,
        description: `${question.prompt}${optionsLine}${skipLine}\n\nType \`cancel\` to stop.`,
        color: COLORS.info
      })
    ]
  })

  const collected = await channel.awaitMessages({
    filter: msg => !msg.author.bot,
    max: 1,
    time: 1000 * 60 * 10
  })

  if (!collected.size) {
    return { status: "timeout" }
  }

  const message = collected.first()
  const content = message.content.trim()

  if (content.toLowerCase() === "cancel") {
    return { status: "cancel" }
  }

  if (content.toLowerCase() === "skip" && !question.required) {
    return { status: "ok", answer: "" }
  }

  if (!content && question.required) {
    return { status: "retry", reason: "This question is required." }
  }

  if (question.kind === "select" && question.options?.length) {
    const match = question.options.find(
      option => option.toLowerCase() === content.toLowerCase()
    )
    if (!match) {
      await channel.send({
        embeds: [
          systemEmbed({
            title: "Invalid choice",
            description: `Please choose one of: ${question.options.join(", ")}`,
            color: COLORS.warning
          })
        ]
      })
      return { status: "retry", reason: "Invalid choice" }
    }
    return { status: "ok", answer: match }
  }

  return { status: "ok", answer: content }
}

module.exports = {
  COMMAND_ENABLED,
  data: new SlashCommandBuilder()
    .setName("apply")
    .setDescription("Submit an application")
    .addStringOption(o =>
      o.setName("type").setDescription("Application type").setRequired(true)
    ),

  async execute(interaction) {
    const guild = interaction.guild
    if (!guild) return

    const type = interaction.options.getString("type").trim().toLowerCase()
    const config = await appsDb.getConfig(guild.id, type)

    if (!config) {
      return interaction.editReply({
        embeds: [systemEmbed({
          title: "Application not found",
          description: `No application type named **${type}** exists.`,
          color: COLORS.warning
        })]
      })
    }

    const user = interaction.user
    const dm = await user.createDM().catch(() => null)
    if (!dm) {
      return interaction.editReply({
        embeds: [systemEmbed({
          title: "Unable to send DM",
          description: "Please enable DMs to apply.",
          color: COLORS.error
        })]
      })
    }

    await interaction.editReply({
      embeds: [systemEmbed({
        title: "Application started",
        description: "Check your DMs to complete the application.",
        color: COLORS.success
      })]
    })

    await dm.send({
      embeds: [systemEmbed({
        title: `${type} application`,
        description: config.description || "Please answer the following questions.",
        color: COLORS.info
      })]
    })

    const answersMap = {}
    const answersList = []
    const questions = config.questions || []

    for (let i = 0; i < questions.length; i += 1) {
      const question = questions[i]
      if (!shouldAsk(question, answersMap)) continue

      let result = await askQuestion(dm, question, answersList.length, questions.length)

      while (result.status === "retry") {
        result = await askQuestion(dm, question, answersList.length, questions.length)
      }

      if (result.status === "timeout") {
        await dm.send({
          embeds: [systemEmbed({
            title: "Application timed out",
            description: "No response received. Please start again with `/apply`.",
            color: COLORS.warning
          })]
        })
        return
      }

      if (result.status === "cancel") {
        await dm.send({
          embeds: [systemEmbed({
            title: "Application cancelled",
            description: "You cancelled the application.",
            color: COLORS.warning
          })]
        })
        return
      }

      answersMap[question.key] = result.answer
      answersList.push({
        key: question.key,
        prompt: question.prompt,
        answer: result.answer
      })
    }

    const submissionId = await appsDb.addSubmission({
      guildId: guild.id,
      type,
      userId: user.id,
      answers: answersList
    })

    await dm.send({
      embeds: [submittedEmbed({
        type,
        guild: guild.name,
        submissionId
      })]
    })

    if (config.reviewChannelId) {
      const channel = guild.channels.cache.get(config.reviewChannelId)
      if (channel?.isTextBased()) {
        await channel.send({
          embeds: [reviewEmbed({
            type,
            user,
            answers: answersList,
            submissionId
          })]
        })
      }
    }
  }
}