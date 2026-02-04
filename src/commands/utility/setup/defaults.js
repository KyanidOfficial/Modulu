const createDraft = (saved, gateRow) => {
  const draft = saved
    ? JSON.parse(JSON.stringify(saved))
    : {
        roles: { moderators: [], administrators: [] },
        channels: { logs: null, serverLogs: null, chatLogs: null, appeals: null, suspicious: null },
        features: { dmOnPunish: true, serverLogs: true, chatLogs: false }
      }

  draft.joinGate = {
    enabled: gateRow?.enabled ?? false,
    accountAgeDays: gateRow?.account_age_days ?? 7,
    requireAvatar: gateRow?.require_avatar ?? true
  }

  draft.features = draft.features || {}
  draft.features.joinGate = draft.joinGate.enabled

  return draft
}

module.exports = { createDraft }