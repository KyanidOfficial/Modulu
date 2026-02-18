"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBaseWeight = getBaseWeight;
exports.computeScaledWeight = computeScaledWeight;
const BASE_WEIGHTS = {
    word_violation: 6,
    link_violation: 10,
    phishing_pattern: 18,
    invite_spam: 12,
    repeated_short_messages: 8,
    spam_burst_small: 6,
    spam_burst_medium: 12,
    spam_burst_large: 20,
    message_interval_drop: 10,
    link_ratio_spike: 12,
    mention_ratio_spike: 8,
    deleted_after_flag: 15,
    prior_warning: 10,
    prior_timeout: 20,
    alt_similarity_low: 10,
    alt_similarity_medium: 18,
    alt_similarity_high: 30,
    behavior_anomaly: 10,
};
const AUTOMOD_SEVERITY_SCALE = {
    1: 1000,
    2: 1200,
    3: 1500,
    4: 2000,
    5: 3000,
};
function getBaseWeight(signalType) {
    if (signalType === 'automod') {
        return 10;
    }
    return BASE_WEIGHTS[signalType];
}
function computeScaledWeight(params) {
    let scaled = params.baseWeight * 1000;
    if (params.accountAgeDays < 7) {
        scaled = Math.floor((scaled * 1300) / 1000);
    }
    if (params.daysInGuild < 1) {
        scaled = Math.floor((scaled * 1200) / 1000);
    }
    if (params.repeatCountWithin10m > 0) {
        const repeatMultiplier = Math.min(3000, 1000 + params.repeatCountWithin10m * 400);
        scaled = Math.floor((scaled * repeatMultiplier) / 1000);
    }
    if (params.automodSeverity !== undefined) {
        scaled = Math.floor((scaled * AUTOMOD_SEVERITY_SCALE[params.automodSeverity]) / 1000);
    }
    return Math.max(0, Math.floor(scaled / 1000));
}
