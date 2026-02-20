module.exports = {
  enabled: process.env.SIM_ENABLED === "true",
  debug: process.env.SIM_DEBUG === "true",
  testMode: process.env.SIM_TEST_MODE === "true",
  baseEnforcementLevel: Math.min(4, Math.max(0, Number(process.env.SIM_ENFORCEMENT_LEVEL || 2))),
  maxEnforcementLevel: Math.min(4, Math.max(0, Number(process.env.SIM_ENFORCEMENT_LEVEL || 2))),
  protectionCooldownMs: Math.max(1000, Number(process.env.SIM_PROTECTION_COOLDOWN_MS || 15 * 60 * 1000)),
  retentionMs: Number(process.env.SIM_RETENTION_MS || 1000 * 60 * 60 * 24 * 14),
  evidenceRetentionMs: Number(process.env.SIM_EVIDENCE_RETENTION_MS || 1000 * 60 * 60 * 24 * 30),
  minorProtectionMode: process.env.SIM_MINOR_PROTECTION_MODE === "true",
  logChannelId: process.env.SIM_LOG_CHANNEL_ID || null,
  thresholds: {
    groomingSoft: Number(process.env.SIM_THRESHOLD_GROOMING_SOFT || 0.62),
    protectionEarly: Number(process.env.SIM_THRESHOLD_PROTECTION_EARLY || 0.6),
    intentCritical: Number(process.env.SIM_THRESHOLD_INTENT_CRITICAL || 0.22),
    clusterCoordination: Number(process.env.SIM_THRESHOLD_CLUSTER || 0.7),
    intervention: {
      level1: Number(process.env.SIM_LEVEL1 || 0.08),
      level2: Number(process.env.SIM_LEVEL2 || 0.12),
      level3: Number(process.env.SIM_LEVEL3 || 0.18),
      level4: Number(process.env.SIM_LEVEL4 || 0.25)
    }
  },
  api: {
    enabled: process.env.SIM_API_ENABLED === "true",
    port: Number(process.env.SIM_API_PORT || 3189)
  },
  featureFlags: {
    victimPreContact: process.env.SIM_FEATURE_VICTIM_PRECONTACT !== "false",
    directedModeling: process.env.SIM_FEATURE_DIRECTED_MODELING !== "false",
    crossServerFingerprints: process.env.SIM_FEATURE_CROSS_SERVER !== "false"
  }
}
