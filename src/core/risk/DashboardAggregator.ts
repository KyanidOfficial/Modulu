import { RiskRepository } from './types';

export class DashboardAggregator {
  public constructor(private readonly repository: RiskRepository) {}

  public async getRiskOverview(guildId: string) {
    return this.repository.getRiskOverview(guildId);
  }

  public async getUserRiskTimeline(guildId: string, userId: string) {
    return this.repository.getUserRiskTimeline(guildId, userId);
  }

  public async getRiskHeatmap(guildId: string) {
    return this.repository.getRiskHeatmap(guildId);
  }

  public async getAltAlerts(guildId: string) {
    return this.repository.getAltAlerts(guildId);
  }

  public async getSignalDistribution(guildId: string) {
    return this.repository.getSignalDistribution(guildId);
  }
}
