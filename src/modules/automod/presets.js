const SHORTENER_DOMAINS = [
  "bit.ly",
  "tinyurl.com",
  "t.co",
  "cutt.ly",
  "rb.gy",
  "is.gd",
  "shorturl.at"
]

const BANNED_WORD_PRESETS = {
  racial_slurs: [
    "racial slur 1",
    "racial slur 2",
    "racial slur 3"
  ],
  hate_speech: [
    "hate phrase 1",
    "hate phrase 2",
    "hate phrase 3"
  ],
  sexual_content: [
    "explicit term 1",
    "explicit term 2",
    "explicit term 3"
  ],
  severe_profanity: [
    "severe profanity 1",
    "severe profanity 2",
    "severe profanity 3"
  ]
}

const normalizeWord = word =>
  String(word || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")

const uniqueNormalized = list => {
  const out = []
  const seen = new Set()

  for (const raw of list || []) {
    const value = normalizeWord(raw)
    if (!value || seen.has(value)) continue
    seen.add(value)
    out.push(value)
  }

  return out
}

module.exports = {
  SHORTENER_DOMAINS,
  BANNED_WORD_PRESETS,
  normalizeWord,
  uniqueNormalized
}
