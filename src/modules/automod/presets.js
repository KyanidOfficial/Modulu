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
    /\bn[i1]gg[e3]r(s)?\b/i,
    /\bf[a@]gg?[o0]t(s)?\b/i,
    /\bch[i1]nk(s)?\b/i,
    /\bsp[i1]c(s)?\b/i
  ],

  hate_speech: [
    /\bkill (all|every) (gays|jews|muslims|blacks|women)\b/i,
    /\bwhite power\b/i,
    /\bgo back to (your|ur) country\b/i,
    /\bheil h[i1]tler\b/i
  ],

  sexual_content: [
    /\bchild porn\b/i,
    /\bnudes?\b/i,
    /\bincest\b/i,
    /\brape\b/i,
    /\bdeepthroat\b/i
  ],

  severe_profanity: [
    /\bf[u*]+ck\b/i,
    /\bsh[i1]t\b/i,
    /\bc[u*]nt\b/i,
    /\bmotherf[u*]+cker\b/i,
    /\bd[i1]ck\b/i
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
