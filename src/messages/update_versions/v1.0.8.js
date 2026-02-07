module.exports = {
  version: "v1.0.8",
  changes: [
    "Introduced shared moderation guards for safer command execution.",
    "Improved moderation logging utilities for clearer action tracking.",
    "Reworked moderation slash commands with stronger validation flow.",
    "Added new moderation commands including softban, voicemute, quarantine, and related reversal actions.",
    "Enhanced purge behavior with safer limits and accurate deletion reporting.",
    "Added new utility commands for improved server management and usability.",
    "Added a deploy validator path to verify command loading consistency.",
    "Removed legacy and unused systems to reduce failure surface.",
    "General stability, consistency, and maintainability improvements."
  ]
}