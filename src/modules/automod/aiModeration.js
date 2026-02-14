const ENDPOINT = process.env.AI_MODERATION_URL || "https://api.openai.com/v1/moderations"

const normalizeResult = (raw, fallbackCategory) => {
  const result = raw?.results?.[0] || raw?.result || {}
  return {
    flagged: Boolean(result.flagged || raw?.flagged),
    categories: result.categories || raw?.categories || {},
    scores: result.category_scores || result.scores || raw?.scores || {},
    raw,
    fallbackCategory
  }
}

module.exports.moderateContent = async ({ text, imageUrl, category }) => {
  if (!process.env.AI_MODERATION_KEY) {
    return {
      skipped: true,
      reason: "AI moderation key not configured"
    }
  }

  const payload = {
    model: process.env.AI_MODERATION_MODEL || "omni-moderation-latest",
    input: []
  }

  if (text) payload.input.push({ type: "text", text })
  if (imageUrl) payload.input.push({ type: "image_url", image_url: { url: imageUrl } })

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.AI_MODERATION_KEY}`
    },
    body: JSON.stringify(payload)
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    return {
      flagged: false,
      error: data?.error?.message || `HTTP ${response.status}`,
      raw: data
    }
  }

  return normalizeResult(data, category)
}
