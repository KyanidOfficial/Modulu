const escapeMarkdownSafe = value => {
  const input = String(value ?? "")

  return input
    .replace(/\\/g, "\\\\")
    .replace(/\*/g, "\\*")
    .replace(/_/g, "\\_")
    .replace(/`/g, "\\`")
    .replace(/~/g, "\\~")
    .replace(/\|/g, "\\|")
}

module.exports = {
  escapeMarkdownSafe
}
