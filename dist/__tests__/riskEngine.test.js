"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const RiskDecay_1 = require("../RiskDecay");
const RiskCalculator_1 = require("../RiskCalculator");
const RiskWeights_1 = require("../RiskWeights");
const BehaviorAnomalyEvaluator_1 = require("../evaluators/BehaviorAnomalyEvaluator");
const AltDetection_1 = require("../AltDetection");
const RiskEngine_1 = require("../RiskEngine");
const now = new Date('2026-01-01T00:00:00.000Z');
(0, node_test_1.default)('piecewise decay uses correct rate bands', () => {
    strict_1.default.equal((0, RiskDecay_1.getPiecewiseDecayRateScaled)(75, 100), 50);
    strict_1.default.equal((0, RiskDecay_1.getPiecewiseDecayRateScaled)(45, 100), 100);
    strict_1.default.equal((0, RiskDecay_1.getPiecewiseDecayRateScaled)(15, 100), 150);
});
(0, node_test_1.default)('piecewise decay applies integer formula and bonus', () => {
    const res = (0, RiskDecay_1.applyDecay)({
        riskScore: 40,
        lastUpdatedAt: new Date(now.getTime() - 73 * 3600 * 1000),
        now,
        baseDecayPerHourScaled: 125,
        hasSignalsWithin72h: false,
    });
    strict_1.default.equal(res.decayPoints, 9);
    strict_1.default.equal(res.bonusApplied, 5);
    strict_1.default.equal(res.newScore, 26);
});
(0, node_test_1.default)('diminishing returns are bounded', () => {
    strict_1.default.equal((0, RiskCalculator_1.applyDiminishingReturn)(90, 20), 92);
    strict_1.default.equal((0, RiskCalculator_1.applyDiminishingReturn)(10, 50), 55);
});
(0, node_test_1.default)('repeat escalation caps at 3x', () => {
    const weight = (0, RiskWeights_1.computeScaledWeight)({ baseWeight: 10, accountAgeDays: 50, daysInGuild: 10, repeatCountWithin10m: 10 });
    strict_1.default.equal(weight, 30);
});
(0, node_test_1.default)('behavior anomaly evaluator updates EMA and detects anomaly', () => {
    const state = {
        guildId: '1', userId: '2', riskScore: 0, riskTrend: 0, lastUpdatedAt: now, version: 1,
        avgMessageLength: 10, shortMessageRatio: 0, avgSecondsBetweenMessages: 60, linkRatio: 0, mentionRatio: 0, altScore: 0,
    };
    const { nextState, anomaly } = (0, BehaviorAnomalyEvaluator_1.evaluateBehaviorAnomaly)({
        state,
        thresholdScaled: 50,
        messageLength: 200,
        isShortMessage: true,
        secondsSincePrevious: 1,
        containsLink: true,
        mentionCount: 2,
    });
    strict_1.default.ok(nextState.avgMessageLength > state.avgMessageLength);
    strict_1.default.equal(anomaly.isAnomaly, true);
});
(0, node_test_1.default)('alt similarity distance yields deterministic score', () => {
    const state = {
        guildId: '1', userId: 'u', riskScore: 0, riskTrend: 0, lastUpdatedAt: now, version: 1,
        avgMessageLength: 100, shortMessageRatio: 100, avgSecondsBetweenMessages: 50, linkRatio: 50, mentionRatio: 20, altScore: 0,
    };
    const alt = (0, AltDetection_1.calculateAltLikelihood)(state, [{ userId: 'b', avgMessageLength: 100, shortMessageRatio: 100, avgSecondsBetweenMessages: 50, linkRatio: 50, mentionRatio: 20 }], 1200);
    strict_1.default.equal(alt.score, 100);
    strict_1.default.equal(alt.distance, 0);
});
class MockTx {
    async beginTransaction() { return; }
    async commit() { return; }
    async rollback() { return; }
    release() { return; }
    async execute(_sql, _params) { throw new Error('not used'); }
}
class MockRepo {
    conflictCount;
    attempts = 0;
    decaysApplied = 0;
    constructor(conflictCount) {
        this.conflictCount = conflictCount;
    }
    baseState = {
        guildId: 'g', userId: 'u', riskScore: 50, riskTrend: 0,
        lastUpdatedAt: new Date(now.getTime() - 3600 * 1000), version: 1,
        avgMessageLength: 0, shortMessageRatio: 0, avgSecondsBetweenMessages: 0, linkRatio: 0, mentionRatio: 0, altScore: 0,
    };
    async withTransaction(handler) {
        return handler(new MockTx(), { now });
    }
    async getGuildRiskConfig(_tx, _guildId) {
        return { guildId: 'g', memberCount: 100, decayRatePerHourScaled: 125, anomalyThresholdScaled: 300, altDistanceThreshold: 1200, updatedAt: now };
    }
    async getUserRiskStateForUpdate(_tx, _guildId, _userId) {
        return this.baseState;
    }
    async insertUserRiskState(_tx, _state) { return; }
    async updateUserRiskStateWithVersion(_tx, state, _expectedVersion) {
        if (state.riskScore < this.baseState.riskScore) {
            this.decaysApplied += 1;
        }
        this.attempts += 1;
        return this.attempts > this.conflictCount;
    }
    async getRepeatCountWithinWindow(_tx, _guildId, _userId, _signalType, _windowSeconds, _occurredAt) { return 0; }
    async insertRiskEventLog(_tx, _event) { return; }
    async insertFeatureVector(_tx, _vector) { return; }
    async getMessageStats(_tx, _guildId, _userId, _now) {
        return { rate10m: 1, rate1h: 1, burstCount10m: 1, automodCount24h: 0, priorModerationCount: 0 };
    }
    async getTopRiskUsers(_guildId, _limit) { return []; }
    async getRiskOverview(_guildId) { return { totalUsers: 0, warningCount: 0, criticalCount: 0, altAlertCount: 0, averageRisk: 0 }; }
    async getUserRiskTimeline(_guildId, _userId) { return []; }
    async getRiskHeatmap(_guildId) { return []; }
    async getAltAlerts(_guildId) { return []; }
    async getSignalDistribution(_guildId) { return []; }
    async getRecentlyBannedBehaviorVectors(_guildId, _limit) { return []; }
}
(0, node_test_1.default)('engine retries on optimistic conflict max 3 and succeeds', async () => {
    const repo = new MockRepo(2);
    const engine = new RiskEngine_1.RiskEngine(repo);
    const result = await engine.recordSignal({ guildId: 'g', userId: 'u', signalType: 'word_violation', accountAgeDays: 30, daysInGuild: 30, occurredAt: now });
    strict_1.default.ok(result.riskScore >= 0);
});
(0, node_test_1.default)('engine throws after max retry conflicts', async () => {
    const repo = new MockRepo(3);
    const engine = new RiskEngine_1.RiskEngine(repo);
    await strict_1.default.rejects(engine.recordSignal({ guildId: 'g', userId: 'u', signalType: 'word_violation', accountAgeDays: 30, daysInGuild: 30, occurredAt: now }), RiskEngine_1.VersionConflictError);
});
(0, node_test_1.default)('no double decay in one transaction path', async () => {
    const repo = new MockRepo(0);
    const engine = new RiskEngine_1.RiskEngine(repo);
    await engine.recordSignal({ guildId: 'g', userId: 'u', signalType: 'word_violation', accountAgeDays: 30, daysInGuild: 30, occurredAt: now });
    strict_1.default.equal(repo.decaysApplied <= 1, true);
});
(0, node_test_1.default)('integer precision remains integer safe', () => {
    const value = (0, RiskWeights_1.computeScaledWeight)({ baseWeight: 18, accountAgeDays: 1, daysInGuild: 0, repeatCountWithin10m: 1, automodSeverity: 3 });
    strict_1.default.equal(Number.isInteger(value), true);
});
