const base = require("./base.embed")
const { EMBED_COLORS } = require("../../utils/constants")

module.exports = ({ action, target, reason, moderator }) =>
  base({
    title: `Moderation: ${action}`,
    description: `${target}`,
    color: EMBED_COLORS.moderation,
    fields: [
      { name: "Reason", value: reason || "No reason provided" },
      { name: "Moderator", value: moderator }
    ]
  })
