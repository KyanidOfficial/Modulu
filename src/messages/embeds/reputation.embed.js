const base = require("./base.embed")
const { EMBED_COLORS } = require("../../utils/constants")

module.exports = ({ title, description }) => base({ title, description, color: EMBED_COLORS.reputation })
