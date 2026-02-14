const base = require("./base.embed")
const { EMBED_COLORS } = require("../../utils/constants")

module.exports = description => base({ title: "Error", description, color: EMBED_COLORS.error })
