const maybeDM = require("../../../utils/maybeDM")

const buildNeutralNotice = () => ({
  content: "We noticed unusual interaction patterns. If you want, you can enable extra safety options: interaction shield, evidence vault, or silent escalation."
})

const triggerVictimProtection = async ({ victimUser, store, sourceId, targetId }) => {
  await maybeDM(victimUser, buildNeutralNotice()).catch(() => null)

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
