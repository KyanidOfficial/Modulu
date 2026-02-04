const { EmbedBuilder } = require("discord.js")
const COLORS = require("../../utils/colors")

module.exports = input => {
  let description = null

  if (typeof input === "string") {
    description = input
  } else if (input && typeof input === "object") {
    description =
      `${input.users} ${input.punishment} ${input.state}\n` +
      `> Reason: ${input.reason}`
  }

  return new EmbedBuilder()
    .setColor(COLORS.success)
    .setDescription(description)
}