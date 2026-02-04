const CACHE = new Map()
const CACHE_TTL = 6 * 60 * 60 * 1000

module.exports.check = async (url, debug = false) => {
  if (debug) {
    console.log("[SB] key loaded:", !!process.env.SAFE_BROWSING_KEY)
    console.log("[SB] checking:", url)
  }

  const cached = CACHE.get(url)
  if (cached && cached.expires > Date.now()) {
    if (debug) console.log("[SB] cache hit:", cached.malicious)
    return cached.malicious
  }

  const res = await fetch(
    `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${process.env.SAFE_BROWSING_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client: {
          clientId: "modulus",
          clientVersion: "1.0"
        },
        threatInfo: {
          threatTypes: [
            "MALWARE",
            "SOCIAL_ENGINEERING",
            "UNWANTED_SOFTWARE"
          ],
          platformTypes: ["ANY_PLATFORM"],
          threatEntryTypes: ["URL"],
          threatEntries: [{ url }]
        }
      })
    }
  )

  if (debug) console.log("[SB] status:", res.status)

  const data = await res.json()
  if (debug) console.log("[SB] response:", JSON.stringify(data))

  const malicious = Array.isArray(data.matches) && data.matches.length > 0

  CACHE.set(url, {
    malicious,
    expires: Date.now() + CACHE_TTL
  })

  return malicious
}