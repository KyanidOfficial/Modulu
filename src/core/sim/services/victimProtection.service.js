const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js")
const maybeDM = require("../../../utils/maybeDM")

const buildNeutralNotice = ({ shieldEnabled = false, sourceId, targetId }) => ({
  content: "Interaction patterns from this account show elevated risk signals. No action has been taken. You may enable optional protections below.",
  components: [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`sim:shield:${sourceId}:${targetId}`)
        .setLabel(shieldEnabled ? "Disable interaction shield" : "Enable interaction shield")
        .setStyle(shieldEnabled ? ButtonStyle.Danger : ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`sim:report:${sourceId}:${targetId}`)
        .setLabel("Silent report")
        .setStyle(ButtonStyle.Danger)
    )
  ]
})

const logToSimChannel = async ({ guildId, sourceId, targetId, severity, intentConfidence, victimUser, logChannelId }) => {
  if (!logChannelId || !victimUser?.client) return
  const maxIntent = Math.max(...Object.values(intentConfidence || {}).map(v => v.confidence || 0), 0)
  const channel = await victimUser.client.channels.fetch(logChannelId).catch(() => null)
  if (!channel?.isTextBased?.()) return

  await channel.send({
    content: `[SIM] Victim protection triggered guild=${guildId} source=${sourceId} target=${targetId} severity=${Number(severity || 0).toFixed(3)} intent=${Number(maxIntent).toFixed(3)}`
  }).catch(() => null)
}

const triggerVictimProtection = async ({
  guildId,
  victimUser,
  store,
  sourceId,
  targetId,
  severity = 0,
  intentConfidence = {},
  logChannelId = null,
  cooldownMs = 15 * 60 * 1000,
  force = false,
  effectiveLevel = null
}) => {
  const key = `${sourceId}->${targetId}`
  const existing = store.interactionPolicies.get(key) || null
  const lastProtectionTimestamp = existing?.lastProtectionTimestamp || 0
  const now = Date.now()
  const firstDetection = !lastProtectionTimestamp
  const forceImmediateByLevel = Number(effectiveLevel || 0) >= 3 && Boolean(targetId)
  const cooldownActive = now - lastProtectionTimestamp < cooldownMs
  const shouldContactVictim = force || firstDetection || forceImmediateByLevel ? true : !cooldownActive

  console.log("[SIM] Protection decision", {
    shouldContactVictim,
    victimResolved: !!victimUser,
    cooldownActive,
    force,
    firstDetection,
    effectiveLevel
  })

  if (!victimUser) {
    console.warn("[SIM] Victim user unresolved; skipping DM", { guildId, sourceId, targetId })
    return { triggered: false, reason: "victim_unresolved", lastProtectionTimestamp }
  }

  if (shouldContactVictim) {
    console.log("[SIM] Victim DM attempt", { guildId, sourceId, targetId, effectiveLevel })
    Promise.resolve(
      maybeDM(guildId, victimUser, buildNeutralNotice({
        sourceId,
        targetId,
        shieldEnabled: Boolean(existing?.restrictDMs)
      }))
    ).then(() => {
      console.log("[SIM] Victim DM success", { guildId, sourceId, targetId, effectiveLevel })
    }).catch(error => {
      console.error(`[SIM] Victim DM failed: ${error?.message || "unknown"}`, { guildId, sourceId, targetId, effectiveLevel })
    })
  }

  await logToSimChannel({ guildId, sourceId, targetId, severity, intentConfidence, victimUser, logChannelId })

  store.interactionPolicies.set(key, {
    restrictDMs: existing?.restrictDMs || false,
    filterLinks: existing?.filterLinks || false,
    messageDelayMs: existing?.messageDelayMs || 0,
    forceModeratedChannel: existing?.forceModeratedChannel || false,
    activatedByVictim: existing?.activatedByVictim || false,
    lastProtectionTimestamp: shouldContactVictim ? now : lastProtectionTimestamp,
    updatedAt: now,
    lastProtectionLevel: effectiveLevel
  })

  return { triggered: shouldContactVictim, lastProtectionTimestamp: shouldContactVictim ? now : lastProtectionTimestamp }
}

module.exports = {
  buildNeutralNotice,
  triggerVictimProtection
}
