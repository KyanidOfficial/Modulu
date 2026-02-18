"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateAltLikelihood = calculateAltLikelihood;
function manhattanDistance(a, b) {
    return (Math.abs(a.avgMessageLength - b.avgMessageLength) +
        Math.abs(a.shortMessageRatio - b.shortMessageRatio) +
        Math.abs(a.avgSecondsBetweenMessages - b.avgSecondsBetweenMessages) +
        Math.abs(a.linkRatio - b.linkRatio) +
        Math.abs(a.mentionRatio - b.mentionRatio));
}
function calculateAltLikelihood(current, vectors, threshold) {
    if (vectors.length === 0) {
        return { userId: current.userId, score: 0 };
    }
    let nearest = vectors[0];
    let nearestDistance = manhattanDistance(current, nearest);
    for (const candidate of vectors.slice(1)) {
        const distance = manhattanDistance(current, candidate);
        if (distance < nearestDistance) {
            nearest = candidate;
            nearestDistance = distance;
        }
    }
    const normalized = Math.max(0, threshold - nearestDistance);
    const score = Math.min(100, Math.floor((normalized * 100) / Math.max(1, threshold)));
    return {
        userId: current.userId,
        score,
        nearestBannedUserId: nearest.userId,
        distance: nearestDistance,
    };
}
