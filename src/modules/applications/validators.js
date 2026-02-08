const normalize = v => v.trim().toLowerCase()

module.exports = {
  normalize,

  validateType(input) {
    const v = normalize(input)
    if (!v) throw new Error("Invalid type")
    if (v.length > 64) throw new Error("Type too long")
    return v
  },

  validateDescription(input) {
    if (!input) return "No description provided."
    if (input.length > 1000) throw new Error("Description too long")
    return input
  }
}