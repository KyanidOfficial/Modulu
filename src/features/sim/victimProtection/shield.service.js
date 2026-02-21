const { getSimService } = require("../../../core/sim")

const applyShieldAction = ({ customId, actorUserId }) => {
  const sim = getSimService()
  if (!sim) return { handled: false, message: "SIM service unavailable." }
  return sim.applyVictimButtonAction?.({ customId, actorUserId }) || { handled: false }
}

module.exports = {
  applyShieldAction
}
