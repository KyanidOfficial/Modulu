const base = require("./base.embed")
const { EMBED_COLORS } = require("../../utils/constants")

module.exports = ({ caseId, action, reason, actorId }) =>
  base({
    title: `Case #${caseId}`,
    description: `Action: ${action}`,
    color: EMBED_COLORS.info,
    fields: [
      { name: "Reason", value: reason || "No reason provided" },
      { name: "Actor", value: actorId }
    ]
  })
