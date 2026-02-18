"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateExponentialMovingAverage = updateExponentialMovingAverage;
exports.evaluateBehaviorAnomaly = evaluateBehaviorAnomaly;
function updateExponentialMovingAverage(oldValue, newValue) {
    return Math.floor((oldValue * 9 + newValue) / 10);
}
function evaluateBehaviorAnomaly(params) {
    const shortScaled = params.isShortMessage ? 1000 : 0;
    const linkScaled = params.containsLink ? 1000 : 0;
    const mentionScaled = params.mentionCount > 0 ? 1000 : 0;
    const nextState = {
        ...params.state,
        avgMessageLength: updateExponentialMovingAverage(params.state.avgMessageLength, params.messageLength),
        shortMessageRatio: updateExponentialMovingAverage(params.state.shortMessageRatio, shortScaled),
        avgSecondsBetweenMessages: updateExponentialMovingAverage(params.state.avgSecondsBetweenMessages, Math.max(0, params.secondsSincePrevious)),
        linkRatio: updateExponentialMovingAverage(params.state.linkRatio, linkScaled),
        mentionRatio: updateExponentialMovingAverage(params.state.mentionRatio, mentionScaled),
    };
    const distanceScaled = Math.abs(nextState.avgMessageLength - params.state.avgMessageLength) +
        Math.abs(nextState.shortMessageRatio - params.state.shortMessageRatio) +
        Math.abs(nextState.avgSecondsBetweenMessages - params.state.avgSecondsBetweenMessages) +
        Math.abs(nextState.linkRatio - params.state.linkRatio) +
        Math.abs(nextState.mentionRatio - params.state.mentionRatio);
    return {
        nextState,
        anomaly: {
            isAnomaly: distanceScaled > params.thresholdScaled,
            signalType: distanceScaled > params.thresholdScaled ? 'behavior_anomaly' : undefined,
            distanceScaled,
        },
    };
}
