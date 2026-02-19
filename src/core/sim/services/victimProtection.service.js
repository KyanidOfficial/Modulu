const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js")
const maybeDM = require("../../../utils/maybeDM")

const buildNeutralNotice = () => ({
  content: "Interaction patterns from this account show elevated risk signals. No action has been taken. You may enable optional protections below.",
  components: [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("sim:shield").setLabel("Enable interaction shield").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("sim:delay").setLabel("Enable message delay").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("sim:links").setLabel("Enable link filtering").setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("sim:evidence").setLabel("Open evidence vault").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("sim:report").setLabel("Silent report").setStyle(ButtonStyle.Danger)
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

const triggerVictimProtection = async ({ guildId, victimUser, store, sourceId, targetId, severity = 0, intentConfidence = {}, logChannelId = null }) => {
  if (victimUser) {
    await maybeDM(guildId, victimUser, buildNeutralNotice()).catch(error => {
      console.error("[SIM] VictimProtection DM failed", { guildId, sourceId, targetId, error: error?.message })
    })
  }

  await logToSimChannel({ guildId, sourceId, targetId, severity, intentConfidence, victimUser, logChannelId })

  const key = `${sourceId}->${targetId}`
  store.interactionPolicies.set(key, {
    restrictDMs: false,
    filterLinks: false,
    messageDelayMs: 0,
    forceModeratedChannel: false,
    activatedByVictim: false,
    updatedAt: Date.now()
  })
}

module.exports = {
  triggerVictimProtection
}
