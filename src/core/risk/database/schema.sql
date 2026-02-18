CREATE TABLE IF NOT EXISTS guild_risk_config (
  guild_id VARCHAR(32) NOT NULL PRIMARY KEY,
  member_count INT UNSIGNED NOT NULL,
  decay_rate_per_hour_scaled INT UNSIGNED NOT NULL,
  anomaly_threshold_scaled INT UNSIGNED NOT NULL DEFAULT 300,
  alt_distance_threshold INT UNSIGNED NOT NULL DEFAULT 1200,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_risk_state (
  guild_id VARCHAR(32) NOT NULL,
  user_id VARCHAR(32) NOT NULL,
  risk_score INT UNSIGNED NOT NULL DEFAULT 0,
  risk_trend INT NOT NULL DEFAULT 0,
  last_updated_at DATETIME(3) NOT NULL,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  avg_message_length INT UNSIGNED NOT NULL DEFAULT 0,
  short_message_ratio INT UNSIGNED NOT NULL DEFAULT 0,
  avg_seconds_between_messages INT UNSIGNED NOT NULL DEFAULT 0,
  link_ratio INT UNSIGNED NOT NULL DEFAULT 0,
  mention_ratio INT UNSIGNED NOT NULL DEFAULT 0,
  alt_score INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (guild_id, user_id),
  INDEX idx_risk_score (guild_id, risk_score DESC),
  INDEX idx_alt_score (guild_id, alt_score DESC)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS risk_event_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  guild_id VARCHAR(32) NOT NULL,
  user_id VARCHAR(32) NOT NULL,
  signal_type VARCHAR(64) NOT NULL,
  signal_weight INT UNSIGNED NOT NULL,
  risk_score_before INT UNSIGNED NOT NULL,
  risk_score_after INT UNSIGNED NOT NULL,
  risk_delta INT NOT NULL,
  metadata_json JSON NOT NULL,
  occurred_at DATETIME(3) NOT NULL,
  INDEX idx_risk_event_user_time (guild_id, user_id, occurred_at DESC),
  INDEX idx_risk_event_signal (guild_id, signal_type, occurred_at DESC)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_behavior_snapshot (
  guild_id VARCHAR(32) NOT NULL,
  user_id VARCHAR(32) NOT NULL,
  avg_message_length INT UNSIGNED NOT NULL,
  short_message_ratio INT UNSIGNED NOT NULL,
  avg_seconds_between_messages INT UNSIGNED NOT NULL,
  link_ratio INT UNSIGNED NOT NULL,
  mention_ratio INT UNSIGNED NOT NULL,
  is_banned TINYINT(1) NOT NULL DEFAULT 0,
  banned_at DATETIME(3) NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (guild_id, user_id),
  INDEX idx_banned_lookup (guild_id, is_banned, banned_at DESC)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS risk_feature_vector (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  guild_id VARCHAR(32) NOT NULL,
  user_id VARCHAR(32) NOT NULL,
  risk_score_before INT UNSIGNED NOT NULL,
  risk_score_after INT UNSIGNED NOT NULL,
  account_age_days INT UNSIGNED NOT NULL,
  days_in_guild INT UNSIGNED NOT NULL,
  message_rate_last_10m INT UNSIGNED NOT NULL,
  message_rate_last_1h INT UNSIGNED NOT NULL,
  avg_message_length INT UNSIGNED NOT NULL,
  short_message_ratio INT UNSIGNED NOT NULL,
  link_ratio INT UNSIGNED NOT NULL,
  mention_ratio INT UNSIGNED NOT NULL,
  spam_burst_count_10m INT UNSIGNED NOT NULL,
  automod_violation_count_24h INT UNSIGNED NOT NULL,
  prior_moderation_count INT UNSIGNED NOT NULL,
  alt_score INT UNSIGNED NOT NULL,
  signal_type VARCHAR(64) NOT NULL,
  signal_weight INT UNSIGNED NOT NULL,
  timestamp DATETIME(3) NOT NULL,
  INDEX idx_feature_user_time (guild_id, user_id, timestamp DESC),
  INDEX idx_feature_signal (guild_id, signal_type, timestamp DESC)
) ENGINE=InnoDB;
