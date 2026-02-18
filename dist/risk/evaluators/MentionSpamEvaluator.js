"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateMentionSpam = evaluateMentionSpam;
function evaluateMentionSpam(mentionRatioScaled, thresholdScaled) {
    if (mentionRatioScaled - thresholdScaled > 120) {
        return 'mention_ratio_spike';
    }
    return null;
}
