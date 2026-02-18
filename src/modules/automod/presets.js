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
    "nigger",
    "nigga",
    "faggot",
    "chink",
    "spic",
    "kike",
    "wetback",
    "coon",
    "paki"
  ],

  hate_speech: [
    "white power",
    "heil hitler",
    "kill all gays",
    "kill all jews",
    "gas the jews",
    "go back to your country",
    "go back to where you came from",
    "burn the gays",
    "death to muslims"
  ],

  sexual_content: [
    "child porn",
    "cp link",
    "send nudes",
    "nudes",
    "dick pic",
    "pussy pic",
    "rape",
    "raped you",
    "incest"
  ],

  severe_profanity: [
    "motherfucker",
    "bitch",
    "asshole",
    "cunt",
    "dick"
  ]
};


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
