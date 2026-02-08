const db = require("../../core/database/applications")
const systemEmbed = require("../../messages/embeds/system.embed")
const COLORS = require("../../utils/colors")

module.exports = async interaction => {
  const type = interaction.options.getString("type").toLowerCase()
  const config = await db.getConfig(interaction.guild.id, type)

  if (!config || config.state !== "open") {
    await interaction.editReply({
      embeds: [
        systemEmbed({
          title: "Unavailable",
          description: "This application is not open.",
          color: COLORS.warning
        })
      ]
    })
    return
  }

  const dm = await interaction.user.createDM().catch(() => null)
  if (!dm) {
    await interaction.editReply({
      embeds: [
        systemEmbed({
          title: "DMs disabled",
          description: "Enable DMs to apply.",
          color: COLORS.error
        })
      ]
    })
    return
  }

  await interaction.editReply({
    embeds: [
      systemEmbed({
        title: "Application started",
        description: "Check your DMs.",
        color: COLORS.success
      })
    ]
  })

  const answers = []
  const questions = Array.isArray(config.questions) ? config.questions : []

  for (const question of questions) {
    await dm.send({
      embeds: [
        systemEmbed({
          title: "Application Question",
          description: question.prompt,
          color: COLORS.info
        })
      ]
    })

    const collected = await dm.awaitMessages({
      max: 1,
      time: 1000 * 60 * 10,
      filter: m => !m.author.bot
    })

    if (!collected.size) {
      await dm.send("Application timed out.")
      return
    }

    answers.push({
      key: question.key,
      prompt: question.prompt,
      answer: collected.first().content
    })
  }

  const id = await db.createSubmission({
    guildId: interaction.guild.id,
    type,
    userId: interaction.user.id,
    answers
  })

  await dm.send({
    embeds: [
      systemEmbed({
        title: "Submitted",
        description: `Application submitted. ID: ${id}`,
        color: COLORS.success
      })
    ]
  })
}