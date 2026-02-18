"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyDiminishingReturn = applyDiminishingReturn;
exports.computeTrend = computeTrend;
exports.clamp = clamp;
function applyDiminishingReturn(oldScore, weight) {
    const boundedOld = clamp(oldScore, 0, 100);
    const safeWeight = Math.max(0, weight);
    const delta = Math.floor((safeWeight * (100 - boundedOld)) / 100);
    return clamp(boundedOld + delta, 0, 100);
}
function computeTrend(previousScore, newScore) {
    return newScore - previousScore;
}
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, Math.floor(value)));
}
