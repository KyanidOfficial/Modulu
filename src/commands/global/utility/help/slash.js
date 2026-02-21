const COMMAND_ENABLED = true
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js")

const COLORS = require("../../../../shared/utils/colors")
const canUse = require("../../../../core/middleware/permissions")

const PAGE_SIZE = 10
const MAX_BUTTONS = 5

module.exports = {
  COMMAND_ENABLED,
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Open help menu"),

  async execute(interaction) {
    const commands = [...interaction.client.commands.values()].filter(c => c.meta)

    const categories = {}
    for (const c of commands) {
      if (!canUse(interaction.member, c.meta.permissions || [])) continue
      const cat = c.meta.category || "Other"
      if (!categories[cat]) categories[cat] = []
      categories[cat].push(c)
    }

    const menuEmbed = new EmbedBuilder()
      .setColor(COLORS.success)
      .setTitle("Help")
      .setDescription("Select a category.")

    const categoryNames = Object.keys(categories)

    const menuRows = []
    for (let i = 0; i < categoryNames.length; i += MAX_BUTTONS) {
      const row = new ActionRowBuilder()
      for (const cat of categoryNames.slice(i, i + MAX_BUTTONS)) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`help_cat:${cat}:0`)
            .setLabel(cat)
            .setStyle(ButtonStyle.Primary)
        )
      }
      menuRows.push(row)
    }

    const msg = await interaction.editReply({
      embeds: [menuEmbed],
      components: menuRows
    })

    const collector = msg.createMessageComponentCollector({
      time: 600000
    })

    collector.on("collect", async i => {
      if (i.user.id !== interaction.user.id) {
        return i.deferUpdate()
      }

      if (i.customId === "help_menu") {
        return i.update({
          embeds: [menuEmbed],
          components: menuRows
        })
      }

      const [, cat, pageRaw] = i.customId.split(":")
      const list = categories[cat]
      if (!list) return i.deferUpdate()

      const page = Number(pageRaw) || 0
      const maxPage = Math.ceil(list.length / PAGE_SIZE) - 1
      const safePage = Math.max(0, Math.min(page, maxPage))

      const slice = list.slice(
        safePage * PAGE_SIZE,
        (safePage + 1) * PAGE_SIZE
      )

      const embed = new EmbedBuilder()
        .setColor(COLORS.success)
        .setTitle(`${cat} Commands`)
        .setFooter({
          text: `Page ${safePage + 1}/${maxPage + 1}`
        })
        .setDescription(
          slice.map(c =>
            `**/${c.data?.name || c.name}**\n` +
            `**description:** ${c.meta.description}\n` +
            `**usage:** ${c.meta.usage}\n` +
            `**example:** ${c.meta.example}`
          ).join("\n\n")
        )

      const navRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`help_cat:${cat}:${safePage - 1}`)
          .setLabel("◀")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(safePage === 0),

        new ButtonBuilder()
          .setCustomId("help_menu")
          .setLabel("Menu")
          .setStyle(ButtonStyle.Danger),

        new ButtonBuilder()
          .setCustomId(`help_cat:${cat}:${safePage + 1}`)
          .setLabel("▶")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(safePage >= maxPage)
      )

      return i.update({
        embeds: [embed],
        components: [navRow]
      })
    })
  }
}