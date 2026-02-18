"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardAggregator = void 0;
class DashboardAggregator {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    async getRiskOverview(guildId) {
        return this.repository.getRiskOverview(guildId);
    }
    async getUserRiskTimeline(guildId, userId) {
        return this.repository.getUserRiskTimeline(guildId, userId);
    }
    async getRiskHeatmap(guildId) {
        return this.repository.getRiskHeatmap(guildId);
    }
    async getAltAlerts(guildId) {
        return this.repository.getAltAlerts(guildId);
    }
    async getSignalDistribution(guildId) {
        return this.repository.getSignalDistribution(guildId);
    }
}
exports.DashboardAggregator = DashboardAggregator;
