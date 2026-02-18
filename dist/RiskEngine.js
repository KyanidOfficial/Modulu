"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiskEngine = exports.VersionConflictError = void 0;
const AltDetection_1 = require("./AltDetection");
const RiskCalculator_1 = require("./RiskCalculator");
const RiskDecay_1 = require("./RiskDecay");
const RiskFeatureVector_1 = require("./RiskFeatureVector");
const RiskWeights_1 = require("./RiskWeights");
const DashboardAggregator_1 = require("./DashboardAggregator");
const BehaviorAnomalyEvaluator_1 = require("./evaluators/BehaviorAnomalyEvaluator");
const MAX_RETRIES = 3;
function createInitialState(guildId, userId, now) {
    return {
        guildId,
        userId,
        riskScore: 0,
        riskTrend: 0,
        lastUpdatedAt: now,
        version: 1,
        avgMessageLength: 0,
        shortMessageRatio: 0,
        avgSecondsBetweenMessages: 0,
        linkRatio: 0,
        mentionRatio: 0,
        altScore: 0,
    };
}
class VersionConflictError extends Error {
}
exports.VersionConflictError = VersionConflictError;
class RiskEngine {
    repository;
    dashboard;
    constructor(repository) {
        this.repository = repository;
        this.dashboard = new DashboardAggregator_1.DashboardAggregator(repository);
    }
    async recordSignal(context) {
        return this.executeWithRetries(context, undefined);
    }
    async recordAutomodSignal(params) {
        const context = {
            guildId: params.guildId,
            userId: params.userId,
            signalType: 'automod',
            accountAgeDays: params.accountAgeDays,
            daysInGuild: params.daysInGuild,
            occurredAt: params.occurredAt,
            metadata: { ...params.signal.metadata, type: params.signal.type, severity: params.signal.severity },
        };
        return this.executeWithRetries(context, params.signal.severity);
    }
    async recordMessageEvent(event) {
        return this.repository.withTransaction(async (tx) => {
            const config = await this.repository.getGuildRiskConfig(tx, event.guildId);
            let state = await this.repository.getUserRiskStateForUpdate(tx, event.guildId, event.userId);
            if (state === null) {
                state = createInitialState(event.guildId, event.userId, event.createdAt);
                await this.repository.insertUserRiskState(tx, state);
            }
            const elapsed = Math.max(0, Math.floor((event.createdAt.getTime() - state.lastUpdatedAt.getTime()) / 1000));
            const { nextState, anomaly } = (0, BehaviorAnomalyEvaluator_1.evaluateBehaviorAnomaly)({
                state,
                thresholdScaled: config.anomalyThresholdScaled,
                messageLength: event.content.length,
                isShortMessage: event.content.trim().length <= 4,
                secondsSincePrevious: elapsed,
                containsLink: event.containsLink,
                mentionCount: event.mentionCount,
            });
            const persisted = await this.repository.updateUserRiskStateWithVersion(tx, {
                ...nextState,
                lastUpdatedAt: event.createdAt,
                riskTrend: 0,
            }, state.version);
            if (!persisted) {
                throw new VersionConflictError('version conflict while recording message event');
            }
            return {
                state: {
                    ...nextState,
                    lastUpdatedAt: event.createdAt,
                    version: state.version + 1,
                },
                anomalyDetected: anomaly.isAnomaly,
            };
        });
    }
    async getUserRisk(guildId, userId) {
        return this.repository.withTransaction(async (tx) => this.repository.getUserRiskStateForUpdate(tx, guildId, userId));
    }
    async getTopRiskUsers(guildId, limit = 25) {
        return this.repository.getTopRiskUsers(guildId, limit);
    }
    async getAltLikelihood(guildId, userId) {
        const state = await this.getUserRisk(guildId, userId);
        if (state === null)
            return 0;
        const vectors = await this.repository.getRecentlyBannedBehaviorVectors(guildId, 200);
        const likelihood = (0, AltDetection_1.calculateAltLikelihood)(state, vectors, 1200);
        return likelihood.score;
    }
    async getRiskOverview(guildId) {
        return this.dashboard.getRiskOverview(guildId);
    }
    async getAltAlerts(guildId) {
        return this.dashboard.getAltAlerts(guildId);
    }
    async getHeatmapData(guildId) {
        return this.dashboard.getRiskHeatmap(guildId);
    }
    async getUserTimeline(guildId, userId) {
        return this.dashboard.getUserRiskTimeline(guildId, userId);
    }
    getDashboardAggregator() {
        return this.dashboard;
    }
    async executeWithRetries(context, automodSeverity) {
        let attempt = 0;
        while (attempt < MAX_RETRIES) {
            try {
                return await this.repository.withTransaction(async (tx, transactionContext) => {
                    const config = await this.repository.getGuildRiskConfig(tx, context.guildId);
                    const existing = await this.repository.getUserRiskStateForUpdate(tx, context.guildId, context.userId);
                    const currentState = existing ?? createInitialState(context.guildId, context.userId, context.occurredAt);
                    if (existing === null) {
                        await this.repository.insertUserRiskState(tx, currentState);
                    }
                    const repeatCount = await this.repository.getRepeatCountWithinWindow(tx, context.guildId, context.userId, context.signalType, 600, context.occurredAt);
                    const decay = (0, RiskDecay_1.applyDecay)({
                        riskScore: currentState.riskScore,
                        lastUpdatedAt: currentState.lastUpdatedAt,
                        now: transactionContext.now,
                        baseDecayPerHourScaled: config.decayRatePerHourScaled,
                        hasSignalsWithin72h: (transactionContext.now.getTime() - currentState.lastUpdatedAt.getTime()) < 72 * 3600 * 1000,
                    });
                    const decayedState = {
                        ...currentState,
                        riskScore: decay.newScore,
                    };
                    const weight = (0, RiskWeights_1.computeScaledWeight)({
                        baseWeight: (0, RiskWeights_1.getBaseWeight)(context.signalType),
                        accountAgeDays: context.accountAgeDays,
                        daysInGuild: context.daysInGuild,
                        repeatCountWithin10m: repeatCount,
                        automodSeverity,
                    });
                    const riskAfter = (0, RiskCalculator_1.applyDiminishingReturn)(decayedState.riskScore, weight);
                    let nextState = {
                        ...decayedState,
                        riskScore: (0, RiskCalculator_1.clamp)(riskAfter, 0, 100),
                        riskTrend: (0, RiskCalculator_1.computeTrend)(currentState.riskScore, riskAfter),
                        lastUpdatedAt: transactionContext.now,
                    };
                    const vectors = await this.repository.getRecentlyBannedBehaviorVectors(context.guildId, 100);
                    const alt = (0, AltDetection_1.calculateAltLikelihood)(nextState, vectors, config.altDistanceThreshold);
                    nextState = {
                        ...nextState,
                        altScore: alt.score,
                    };
                    const persisted = await this.repository.updateUserRiskStateWithVersion(tx, nextState, currentState.version);
                    if (!persisted) {
                        throw new VersionConflictError('optimistic lock conflict');
                    }
                    await this.repository.insertRiskEventLog(tx, {
                        guildId: context.guildId,
                        userId: context.userId,
                        signalType: context.signalType,
                        signalWeight: weight,
                        riskScoreBefore: currentState.riskScore,
                        riskScoreAfter: nextState.riskScore,
                        riskDelta: nextState.riskScore - currentState.riskScore,
                        metadataJson: JSON.stringify(context.metadata ?? {}),
                        occurredAt: context.occurredAt,
                    });
                    const stats = await this.repository.getMessageStats(tx, context.guildId, context.userId, transactionContext.now);
                    await this.repository.insertFeatureVector(tx, (0, RiskFeatureVector_1.buildFeatureVector)({
                        context,
                        stateBefore: currentState,
                        stateAfter: nextState,
                        signalWeight: weight,
                        messageRateLast10m: stats.rate10m,
                        messageRateLast1h: stats.rate1h,
                        spamBurstCount10m: stats.burstCount10m,
                        automodViolationCount24h: stats.automodCount24h,
                        priorModerationCount: stats.priorModerationCount,
                    }));
                    return {
                        ...nextState,
                        version: currentState.version + 1,
                    };
                });
            }
            catch (error) {
                if (error instanceof VersionConflictError) {
                    attempt += 1;
                    continue;
                }
                throw error;
            }
        }
        throw new VersionConflictError('max retries exceeded');
    }
}
exports.RiskEngine = RiskEngine;
