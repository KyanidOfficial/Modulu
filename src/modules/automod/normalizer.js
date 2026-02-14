const REPLACEMENTS = {
  "@": "a",
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "8": "b",
  "$": "s",
  "!": "i",
  "|": "i"
}

const stripInvisible = value =>
  value.replace(/[\u200B-\u200D\uFEFF\u2060\u180E]/g, "")

module.exports.normalizeText = input => {
  if (!input) return ""

  const decomposed = stripInvisible(input)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")

  return Array.from(decomposed.toLowerCase())
    .map(char => REPLACEMENTS[char] || char)
    .join("")
}
