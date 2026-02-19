module.exports = {
  enabled: process.env.SIM_ENABLED !== "false",
  retentionMs: Number(process.env.SIM_RETENTION_MS || 1000 * 60 * 60 * 24 * 14),
  evidenceRetentionMs: Number(process.env.SIM_EVIDENCE_RETENTION_MS || 1000 * 60 * 60 * 24 * 30),
  minorProtectionMode: process.env.SIM_MINOR_PROTECTION_MODE === "true",
  thresholds: {
    groomingSoft: Number(process.env.SIM_THRESHOLD_GROOMING_SOFT || 0.62),
    intentCritical: Number(process.env.SIM_THRESHOLD_INTENT_CRITICAL || 0.93),
    clusterCoordination: Number(process.env.SIM_THRESHOLD_CLUSTER || 0.7),
    intervention: {
      level1: Number(process.env.SIM_LEVEL1 || 0.35),
      level2: Number(process.env.SIM_LEVEL2 || 0.5),
      level3: Number(process.env.SIM_LEVEL3 || 0.65),
      level4: Number(process.env.SIM_LEVEL4 || 0.82)
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
