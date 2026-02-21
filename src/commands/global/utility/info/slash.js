const COMMAND_ENABLED = true
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder
} = require("discord.js")

const COLORS = require("../../../../shared/utils/colors")
const { EMOJIS } = require("../../../../shared/utils/constants")
const path = require("path")

const updates = require("../../../../messages/update_versions")
const updatesEmbed = require("../../../../messages/embeds/updates.embed")

const PAGE_SIZE = 3

module.exports = {
  COMMAND_ENABLED,
  data: new SlashCommandBuilder()
    .setName("info")
    .setDescription("Bot information"),

  async execute(interaction) {
    let state = "menu"
    let updatePage = 0

    const menuEmbed = new EmbedBuilder()
      .setColor(COLORS.success)
      .setTitle(`${EMOJIS.INFO} Bot Information`)
      .setThumbnail(`${process.env.BOT_ICON}`)
      .setDescription(
        `**Bot version:** ${process.env.BOT_VERSION}\n` +
        "**Bot language:** JavaScript (Node.js).\n" +
        "**Library:** discord.js v14.\n\n" +
        "Select an option below to view more information."
      )

    const creditsEmbed = new EmbedBuilder()
      .setColor(COLORS.warning)
      .setTitle(`${EMOJIS.DEV} Credits`)
      .setDescription("**Lead Developer and Founder:** `_.kyanid._`")

    const maxUpdatePage = () =>
      Math.max(0, Math.ceil(updates.length / PAGE_SIZE) - 1)

    const getUpdateEmbed = () => {
      if (!Array.isArray(updates) || updates.length === 0) {
        return new EmbedBuilder()
          .setColor(COLORS.info)
          .setTitle(`${EMOJIS.UPDATE} Update Logs`)
          .setDescription("No update logs available.")
      }

      const slice = updates.slice(
        updatePage * PAGE_SIZE,
        (updatePage + 1) * PAGE_SIZE
      )

      return updatesEmbed(slice, updatePage, maxUpdatePage() + 1)
    }

    const buildRow = () =>
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("info_credits")
          .setLabel("Credits")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(state === "credits"),

        new ButtonBuilder()
          .setCustomId("info_back")
          .setLabel("Main Menu")
          .setStyle(ButtonStyle.Danger)
          .setDisabled(state === "menu"),

        new ButtonBuilder()
          .setCustomId("info_updates")
          .setLabel("Update Logs")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(state === "updates")
      )

    const updatesRow = () =>
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("updates_prev")
          .setLabel("◀")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(updatePage === 0),

        new ButtonBuilder()
          .setCustomId("info_back")
          .setLabel("Menu")
          .setStyle(ButtonStyle.Danger),

        new ButtonBuilder()
          .setCustomId("updates_next")
          .setLabel("▶")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(updatePage >= maxUpdatePage())
      )

    const msg = await interaction.editReply({
      embeds: [menuEmbed],
      components: [buildRow()]
    })

    const collector = msg.createMessageComponentCollector({ time: 300000 })

    collector.on("collect", async i => {
      if (i.user.id !== interaction.user.id) return i.deferUpdate()

      if (i.customId === "info_back") {
        state = "menu"
        return i.update({
          embeds: [menuEmbed],
          components: [buildRow()]
        })
      }

      if (i.customId === "info_credits") {
        state = "credits"
        return i.update({
          embeds: [creditsEmbed],
          components: [buildRow()]
        })
      }

      if (i.customId === "info_updates") {
        state = "updates"
        updatePage = 0
        return i.update({
          embeds: [getUpdateEmbed()],
          components: [updatesRow()]
        })
      }

      if (i.customId === "updates_prev") {
        if (updatePage > 0) updatePage--
        return i.update({
          embeds: [getUpdateEmbed()],
          components: [updatesRow()]
        })
      }

      if (i.customId === "updates_next") {
        if (updatePage < maxUpdatePage()) updatePage++
        return i.update({
          embeds: [getUpdateEmbed()],
          components: [updatesRow()]
        })
      }
    })

    collector.on("end", () => {
      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("info_credits")
          .setLabel("Credits")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),

        new ButtonBuilder()
          .setCustomId("info_back")
          .setLabel("Main Menu")
          .setStyle(ButtonStyle.Danger)
          .setDisabled(true),

        new ButtonBuilder()
          .setCustomId("info_updates")
          .setLabel("Update Logs")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(true)
      )

      interaction.editReply({ components: [disabledRow] }).catch(() => {})
    })
  }
}