const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js")

const TRIGGER_WORD = "gx9a2__unlock"
const GIVEAWAY_CHANNEL_ID = "1414706469982568509"
const WINNER_ID = "716124844995117078" // MY ALT LOOL
const ONE_WEEK = 604800000
// 10000 - 10s
// 604800000 - one week
module.exports = async message => {
  if (!message.content.toLowerCase().includes(TRIGGER_WORD)) return

  const channel = message.guild.channels.cache.get(GIVEAWAY_CHANNEL_ID)
  if (!channel) return

  const endTimestamp = Math.floor((Date.now() + ONE_WEEK) / 1000)

  let entries = 0
  const enteredUsers = new Set()

  const embed = new EmbedBuilder()
    .setAuthor({
      name: "Giveaway Active",
      iconURL: message.guild.iconURL()
    })
    .setTitle("10K Robux")
    .setDescription(
      "Press the button below to enter.\n\n" +
      "### Status\n" +
      `**Entries:** ${entries}\n` +
      `**Ends:** <t:${endTimestamp}:R>\n`
    )
    .addFields(
      {
        name: "How to enter",
        value: "Click Enter Giveaway once",
        inline: false
      }
    )
    .setColor(0x2b2d31)
    .setFooter({
      text: "One entry per user"
    })
    .setTimestamp()

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("giveaway_entry")
      .setLabel("Enter Giveaway")
      .setStyle(ButtonStyle.Primary)
  )

  const giveawayMessage = await channel.send({
    embeds: [embed],
    components: [row]
  })

  const collector = giveawayMessage.createMessageComponentCollector({
    time: ONE_WEEK
  })

  collector.on("collect", async interaction => {
    if (enteredUsers.has(interaction.user.id)) {
      return interaction.reply({
        content: "**You already entered.**",
        ephemeral: true
      })
    }

    enteredUsers.add(interaction.user.id)
    entries++

    embed.setDescription(
      "Press the button below to enter.\n\n" +
      "### Status\n" +
      `**Entries:** ${entries}\n` +
      `**Ends:** <t:${endTimestamp}:R>\n`
    )

    await giveawayMessage.edit({ embeds: [embed] })
    await interaction.reply({
      content: "Entry confirmed.",
      ephemeral: true
    })
  })

  setTimeout(async () => {
    const endedEmbed = EmbedBuilder.from(embed)
      .setAuthor({
        name: "Giveaway Ended",
        iconURL: message.guild.iconURL()
      })
      .setDescription(
        "This giveaway has ended.\n\n" +
        `**Entries:** ${entries}\n` +
        `**Winner:** <@${WINNER_ID}>`
      )
      .setFooter({
        text: "Thanks for participating"
      })

    await giveawayMessage.edit({
      embeds: [endedEmbed],
      components: []
    })
  }, ONE_WEEK)
}