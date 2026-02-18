const fs = require("node:fs")
const path = require("node:path")
const { getRiskRuntimeStatus } = require("../runtime")

const panelPath = path.resolve(__dirname, "../../../../dist/risk/panel/RiskPanelController.js")

const loadPanel = () => {
  if (!fs.existsSync(panelPath)) {
    return { mod: null, missing: true }
  }

  try {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const mod = require(panelPath)
    return { mod, missing: false }
  } catch (error) {
    console.error(`[RISK] Failed to load panel module at ${panelPath}`)
    console.error(error)
    return { mod: null, missing: false }
  }
}

const replyUnavailable = async interaction => {
  const runtime = getRiskRuntimeStatus()
  const missingBuild = runtime.errorCode === "DIST_MISSING_AFTER_BUILD"

  const content = missingBuild
    ? "Risk build artifacts are missing after auto-build attempt. Check startup logs."
    : "RiskEngine failed to initialize. Check startup logs."

  const payload = { content, ephemeral: true }
  if (interaction.deferred || interaction.replied) {
    await interaction.followUp(payload).catch(() => {})
  } else {
    await interaction.reply(payload).catch(() => {})
  }
}

const handleRiskSlash = async (interaction, engine) => {
  const panel = loadPanel()
  if (!panel.mod || !engine) {
    await replyUnavailable(interaction)
    return
  }

  await panel.mod.handleRiskSlash(interaction, engine)
}

const handleRiskComponent = async (interaction, engine) => {
  const panel = loadPanel()
  if (!panel.mod || !engine) return
  await panel.mod.handleRiskComponent(interaction, engine)
}

module.exports = {
  handleRiskSlash,
  handleRiskComponent
}
