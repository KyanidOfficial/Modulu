const roles = require("./roles.handler")
const channels = require("./channels.handler")
const features = require("./features.handler")
const joingate = require("./joingate.handler")
const harmfulLinks = require("./harmfulLinks.handler")
const confirm = require("./confirm.handler")

const map = {
  // roles
  setup_roles: roles.openRoles,
  setup_roles_moderator: roles.openModeratorSelect,
  setup_roles_moderator_select: roles.selectModeratorRoles,
  setup_roles_admin: roles.openAdminSelect,
  setup_roles_admin_select: roles.selectAdminRoles,
  setup_roles_back: roles.backToMain,

  // channels
  setup_channels: channels.openChannels,
  setup_channels_mod: channels.openModSelect,
  setup_channels_mod_select: channels.selectModChannel,
  setup_channels_server: channels.openServerSelect,
  setup_channels_server_select: channels.selectServerChannel,
  setup_channels_chat: channels.openChatSelect,
  setup_channels_chat_select: channels.selectChatChannel,
  setup_channels_back: channels.backToMain,

  // features
  setup_features: features.openFeatures,
  setup_features_back: features.backToMain,
  toggle_dm: features.toggleDM,
  toggle_server_logs: features.toggleServerLogs,
  toggle_chat_logs: features.toggleChatLogs,
  toggle_joingate: features.toggleJoinGate,
  setup_joingate_config: features.openJoinGateConfig,

  // joingate
  setup_joingate_age_plus: joingate.increaseAge,
  setup_joingate_age_minus: joingate.decreaseAge,
  setup_joingate_requireAvatar: joingate.toggleRequireAvatar,
  setup_joingate_back: joingate.backToFeatures,

  // harmful links
  toggle_harmful_links: harmfulLinks.toggleHarmfulLinks,
  setup_harmful_links_config: harmfulLinks.openHarmfulLinksConfig,
  toggle_hl_scanstaff: harmfulLinks.toggleScanStaff,
  toggle_hl_timeout: harmfulLinks.toggleTimeout,
  hl_time_plus: harmfulLinks.timeoutPlus,
  hl_time_minus: harmfulLinks.timeoutMinus,
  setup_hl_back: harmfulLinks.backToFeatures,

  // confirm / cancel
  setup_preview: confirm.preview,
  setup_confirm: confirm.confirm,
  setup_cancel: confirm.cancel
}

module.exports.handle = async (i, interaction, session, store, collector, helpers) => {
  const h = map[i.customId]
  if (!h) return i.deferUpdate()
  return h(i, interaction, session, store, collector, helpers)
}
