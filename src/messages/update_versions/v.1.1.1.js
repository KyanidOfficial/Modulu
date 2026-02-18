module.exports = {
  version: "v1.1.1",
  changes: [
    "Complete AutoMod system rewrite for stability and deterministic behavior",
    "Fixed link enforcement so blockedDomains are always respected",
    "Discord invite links are now reliably blocked",
    "Proper root-domain normalization (subdomains now match correctly)",
    "Removed legacy spamProtection system to prevent conflicts",
    "Fixed spam detection requiring both rate and similarity conditions",
    "Improved duplicate message detection accuracy",
    "Adjusted spam thresholds to reduce false positives",
    "Fixed punishment pipeline so delete and timeout always execute correctly",
    "Fixed incorrect LIMIT binding causing ER_WRONG_ARGUMENTS crash",
    "Hardened database calls to prevent bot crashes",
    "Improved permission checks before delete and timeout",
    "Added additional try/catch protection to messageCreate pipeline",
    "Eliminated unhandled promise rejection crash sources",
    "Improved overall AutoMod performance and memory safety"
  ]
}