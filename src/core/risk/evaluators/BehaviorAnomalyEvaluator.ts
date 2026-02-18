import { BehaviorAnomalyResult, UserRiskState } from '../types';

export function updateExponentialMovingAverage(oldValue: number, newValue: number): number {
  return Math.floor((oldValue * 9 + newValue) / 10);
}

export function evaluateBehaviorAnomaly(params: {
  state: UserRiskState;
  thresholdScaled: number;
  messageLength: number;
  isShortMessage: boolean;
  secondsSincePrevious: number;
  containsLink: boolean;
  mentionCount: number;
}): { nextState: UserRiskState; anomaly: BehaviorAnomalyResult } {
  const shortScaled = params.isShortMessage ? 1000 : 0;
  const linkScaled = params.containsLink ? 1000 : 0;
  const mentionScaled = params.mentionCount > 0 ? 1000 : 0;

  const nextState: UserRiskState = {
    ...params.state,
    avgMessageLength: updateExponentialMovingAverage(params.state.avgMessageLength, params.messageLength),
    shortMessageRatio: updateExponentialMovingAverage(params.state.shortMessageRatio, shortScaled),
    avgSecondsBetweenMessages: updateExponentialMovingAverage(
      params.state.avgSecondsBetweenMessages,
      Math.max(0, params.secondsSincePrevious),
    ),
    linkRatio: updateExponentialMovingAverage(params.state.linkRatio, linkScaled),
    mentionRatio: updateExponentialMovingAverage(params.state.mentionRatio, mentionScaled),
  };

  const distanceScaled =
    Math.abs(nextState.avgMessageLength - params.state.avgMessageLength) +
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
