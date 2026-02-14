const { EmbedBuilder } = require("discord.js")
const COLORS = require("../../../utils/colors")

module.exports = {
  name: "info",

  async execute(msg) {
    const embed = new EmbedBuilder()
      .setColor(COLORS.success)
      .setTitle("Bot Information")
      .setDescription(
        "**Lead Developer/Founder:** `@_.kyanid._`\n" +
        `**Version:** ${process.env.BOT_VERSION}\n\n` +
        "Use `/info` for interactive menu."
      )

    msg.channel.send({ embeds: [embed] })
  }
}