const COMMAND_ENABLED = true
const { SlashCommandBuilder, PermissionsBitField } = require("discord.js")

const store = require("../../../../core/setup/session.store")
const db = require("../../../../core/database")
const joinGateDb = require("../../../../core/database/joinGate")
const harmfulLinksDb = require("../../../../core/database/harmfulLinks")

const startEmbed = require("../../../../messages/embeds/setup.start.embed")
const previewEmbed = require("../../../../messages/embeds/setup.preview.embed")
const completedEmbed = require("../../../../messages/embeds/setup.completed.embed")
const cancelledEmbed = require("../../../../messages/embeds/setup.cancelled.embed")

const defaults = require("./defaults")
const mainRows = require("./builders/main.rows")
const featuresRows = require("./builders/features.rows")
const joingateRows = require("./builders/joingate.rows")
const harmfulLinksRows = require("./builders/harmfulLinks.rows")

const dispatcher = require("./handlers/dispatcher")

module.exports = {
  COMMAND_ENABLED,
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Guided server setup"),

  async execute(interaction) {
    const guild = interaction.guild
    if (!guild) throw new Error("No guild")

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.editReply({ embeds: [completedEmbed("Administrator permission required.")] })
    }

    const savedRow = await db.get(guild.id)
    const saved = savedRow?.setup
    const gateRow = await joinGateDb.get(guild.id)

    const draft = defaults.createDraft(saved, gateRow)

    draft.harmfulLinks = draft.harmfulLinks || {
      enabled: true,
      scanStaff: false,
      timeout: { enabled: false, duration: 10 * 60 * 1000 },
      log: true
    }

    draft.features.harmfulLinks ??= draft.harmfulLinks.enabled
    draft.view = draft.view || "main"

    store.set(guild.id, draft)

    const msg = await interaction.editReply({
      embeds: [startEmbed(guild)],
      components: [mainRows.buildMainRow()]
    })

    const collector = msg.createMessageComponentCollector({ time: 900000 })

    collector.on("collect", async i => {
      if (i.user.id !== interaction.user.id) return i.deferUpdate()
      const session = store.get(guild.id)
      if (!session) return i.deferUpdate()

      // ensure defaults
      session.joinGate ??= { enabled: false, accountAgeDays: 7, requireAvatar: true }
      session.harmfulLinks ??= { enabled: true, scanStaff: false, timeout: { enabled: false, duration: 10 * 60 * 1000 }, log: true }
      session.features ??= {}
      session.features.joinGate ??= session.joinGate.enabled
      session.features.harmfulLinks ??= session.harmfulLinks.enabled

      // delegate to dispatcher
      try {
        await dispatcher.handle(i, interaction, session, store, collector, {
          previewEmbed,
          startEmbed,
          completedEmbed,
          cancelledEmbed,
          mainRows,
          featuresRows,
          joingateRows,
          harmfulLinksRows,
          db,
          joinGateDb,
          harmfulLinksDb
        })
      } catch (err) {
        console.error("setup dispatcher error", err)
        return i.deferUpdate()
      }
    })

    collector.on("end", () => store.clear(guild.id))
  }
}