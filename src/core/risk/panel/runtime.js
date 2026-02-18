const path = require("path")

const loadPanel = () => {
  try {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    return require(path.join(__dirname, "../../../../dist/panel/RiskPanelController.js"))
  } catch {
    return null
  }
}

const replyUnavailable = async interaction => {
  const payload = { content: "Risk panel is not built yet. Run `npm run build:risk`.", ephemeral: true }
  if (interaction.deferred || interaction.replied) {
    await interaction.followUp(payload).catch(() => {})
  } else {
    await interaction.reply(payload).catch(() => {})
  }
}

const handleRiskSlash = async (interaction, engine) => {
  const mod = loadPanel()
  if (!mod || !engine) {
    await replyUnavailable(interaction)
    return
  }

  await mod.handleRiskSlash(interaction, engine)
}

const handleRiskComponent = async (interaction, engine) => {
  const mod = loadPanel()
  if (!mod || !engine) return
  await mod.handleRiskComponent(interaction, engine)
}

module.exports = {
  handleRiskSlash,
  handleRiskComponent
}
