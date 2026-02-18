import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  GuildMember,
  PermissionsBitField,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  userMention,
} from 'discord.js';
import { RiskEngine } from '../RiskEngine';
import { AltComparisonVector, TopRiskUser, UserRiskState } from '../types';
import { applyDecay } from '../RiskDecay';

const commandCooldown = new Map<string, number>();
const overviewCache = new Map<string, { expiresAt: number; value: Awaited<ReturnType<RiskEngine['getRiskOverview']>> }>();

const COOLDOWN_MS = 3000;
const OVERVIEW_CACHE_MS = 30000;
const PAGE_SIZE = 25;

function hasPermission(member: GuildMember | null): boolean {
  if (member === null) return false;
  return member.permissions.has(PermissionsBitField.Flags.ManageGuild);
}

function trendArrow(trend: number): string {
  if (trend > 0) return '⬆️';
  if (trend < 0) return '⬇️';
  return '➡️';
}

function colorForRisk(risk: number): number {
  if (risk >= 80) return 0xed4245;
  if (risk >= 60) return 0xfaa61a;
  return 0x57f287;
}

function timelineGraph(points: Array<{ riskScoreAfter: number }>): string {
  if (points.length === 0) return 'No timeline events in last 24h.';
  const bars = points.slice(0, 24).reverse().map((p) => {
    const blocks = Math.max(1, Math.floor(p.riskScoreAfter / 10));
    return `${'█'.repeat(blocks).padEnd(10, '░')} ${p.riskScoreAfter}`;
  });
  return `\`\`\`\n${bars.join('\n')}\n\`\`\``;
}

function userActionRows(guildId: string, userId: string) {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`risk:user:timeline:${guildId}:${userId}`).setLabel('View Timeline').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`risk:user:signals:${guildId}:${userId}`).setLabel('View Signals').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`risk:user:refresh:${guildId}:${userId}`).setLabel('Refresh').setStyle(ButtonStyle.Primary),
    ),
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`risk:user:select:${guildId}:${userId}`)
        .setPlaceholder('Quick views')
        .addOptions(
          { label: 'Overview', value: 'overview' },
          { label: 'Timeline (24h)', value: 'timeline' },
          { label: 'Recent Signals', value: 'signals' },
        ),
    ),
  ];
}

async function enforce(interaction: ChatInputCommandInteraction | ButtonInteraction | StringSelectMenuInteraction): Promise<boolean> {
  if (!interaction.guildId || !interaction.guild) {
    await interaction.reply({ content: 'This command only works in a server.', ephemeral: true });
    return false;
  }

  const member = interaction.member as GuildMember | null;
  if (!hasPermission(member)) {
    await interaction.reply({ content: 'You need Manage Server permission.', ephemeral: true });
    return false;
  }

  const key = `${interaction.guildId}:${interaction.user.id}`;
  const last = commandCooldown.get(key) ?? 0;
  if (Date.now() - last < COOLDOWN_MS) {
    await interaction.reply({ content: 'Slow down. Try again in a moment.', ephemeral: true });
    return false;
  }
  commandCooldown.set(key, Date.now());
  return true;
}

async function buildUserEmbed(engine: RiskEngine, guildId: string, userId: string): Promise<EmbedBuilder> {
  const risk = await engine.getUserRisk(guildId, userId);
  if (risk === null) {
    return new EmbedBuilder().setColor(0x5865f2).setTitle('Risk User').setDescription('No risk data found for this user.');
  }

  const timeline = await engine.getUserTimeline(guildId, userId);
  const signals = timeline.slice(0, 5).map((p) => `• ${p.signalType} (${p.riskScoreAfter})`).join('\n') || 'No recent signals.';

  const projection = applyDecay({
    riskScore: risk.riskScore,
    lastUpdatedAt: new Date(),
    now: new Date(Date.now() + 6 * 3600 * 1000),
    baseDecayPerHourScaled: 125,
    hasSignalsWithin72h: true,
  }).newScore;

  const accountAgeDays = Math.max(0, Math.floor((Date.now() - Number(BigInt(userId) % BigInt(Date.now()))) / 86400000));

  return new EmbedBuilder()
    .setColor(colorForRisk(risk.riskScore))
    .setTitle('Risk User')
    .setDescription(`${userMention(userId)}`)
    .addFields(
      { name: 'Current Risk', value: `${risk.riskScore}`, inline: true },
      { name: 'Alt Score', value: `${risk.altScore}`, inline: true },
      { name: 'Trend', value: `${trendArrow(risk.riskTrend)} ${risk.riskTrend}`, inline: true },
      { name: 'Projection (6h)', value: `${projection}`, inline: true },
      { name: 'Account Age', value: `${accountAgeDays} days`, inline: true },
      { name: 'Days in Guild', value: 'Calculated by join date in live flow', inline: true },
      { name: 'Last 5 signals', value: signals, inline: false },
    )
    .setTimestamp(new Date());
}

export async function handleRiskSlash(interaction: ChatInputCommandInteraction, engine: RiskEngine): Promise<void> {
  if (!(await enforce(interaction))) return;

  const sub = interaction.options.getSubcommand();
  const guildId = interaction.guildId as string;

  try {
    if (sub === 'overview') {
      const cached = overviewCache.get(guildId);
      const overview = cached && cached.expiresAt > Date.now() ? cached.value : await engine.getRiskOverview(guildId);
      if (!cached || cached.expiresAt <= Date.now()) {
        overviewCache.set(guildId, { expiresAt: Date.now() + OVERVIEW_CACHE_MS, value: overview });
      }

      const top = await engine.getTopRiskUsers(guildId, 5);
      const topValue = top.map((u, i) => `${i + 1}. ${userMention(u.userId)} • ${u.riskScore}`).join('\n') || 'No users.';
      const color = colorForRisk(Math.max(overview.averageRisk, top[0]?.riskScore ?? 0));

      await interaction.reply({
        ephemeral: true,
        embeds: [
          new EmbedBuilder()
            .setColor(color)
            .setTitle('Risk Overview')
            .addFields(
              { name: 'Total tracked users', value: `${overview.totalUsers}`, inline: true },
              { name: 'High risk (>=60)', value: `${overview.warningCount}`, inline: true },
              { name: 'Critical (>=80)', value: `${overview.criticalCount}`, inline: true },
              { name: 'Average risk', value: `${overview.averageRisk}`, inline: true },
              { name: 'Risk delta (24h)', value: 'Derived from trends in timeline view', inline: true },
              { name: 'Top 5 users', value: topValue, inline: false },
            ),
        ],
      });
      return;
    }

    if (sub === 'user') {
      const target = interaction.options.getUser('user', true);
      const embed = await buildUserEmbed(engine, guildId, target.id);
      await interaction.reply({ ephemeral: true, embeds: [embed], components: userActionRows(guildId, target.id) });
      return;
    }

    if (sub === 'top') {
      const users = await engine.getTopRiskUsers(guildId, PAGE_SIZE);
      const description = users.map((u, i) => `#${i + 1} ${userMention(u.userId)} • Risk ${u.riskScore} • Alt ${u.altScore} ${trendArrow(u.riskTrend)}`).join('\n') || 'No users.';
      await interaction.reply({
        ephemeral: true,
        embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('Top Risk Users').setDescription(description)],
        components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(`risk:top:prev:${guildId}:0`).setLabel('Previous').setStyle(ButtonStyle.Secondary).setDisabled(true),
          new ButtonBuilder().setCustomId(`risk:top:next:${guildId}:0`).setLabel('Next').setStyle(ButtonStyle.Secondary).setDisabled(users.length < PAGE_SIZE),
        )],
      });
      return;
    }

    if (sub === 'alts') {
      const alerts = await engine.getAltAlerts(guildId);
      const rows = alerts.slice(0, 25).map((a) => `${userMention(a.userId)} • Alt ${a.altScore} • Closest matches: data available in user panel`).join('\n') || 'No alt alerts.';
      await interaction.reply({ ephemeral: true, embeds: [new EmbedBuilder().setColor(0xed4245).setTitle('Alt Alerts (>=70)').setDescription(rows)] });
      return;
    }

    if (sub === 'heatmap') {
      const data = await engine.getHeatmapData(guildId);
      const rows = data.slice(0, 12).map((d) => `${d.hourBucket} | spikes:${d.eventCount} | high:${Math.abs(d.averageDelta)}`).join('\n');
      await interaction.reply({
        ephemeral: true,
        embeds: [new EmbedBuilder().setColor(0xfaa61a).setTitle('Risk Heatmap (last 6h)').setDescription(`\`\`\`\n${rows || 'No data'}\n\`\`\``)],
      });
    }
  } catch (error) {
    await interaction.reply({ content: 'Failed to load risk panel.', ephemeral: true }).catch(() => undefined);
  }
}

export async function handleRiskComponent(interaction: ButtonInteraction | StringSelectMenuInteraction, engine: RiskEngine): Promise<void> {
  if (!interaction.guildId) return;

  const parts = interaction.customId.split(':');
  if (parts[1] !== 'user' && parts[1] !== 'top') return;

  if (parts[1] === 'user') {
    const guildId = parts[3];
    const userId = parts[4];
    if (interaction.isButton()) {
      if (parts[2] === 'refresh') {
        const embed = await buildUserEmbed(engine, guildId, userId);
        await interaction.update({ embeds: [embed], components: userActionRows(guildId, userId) });
        return;
      }
      if (parts[2] === 'timeline') {
        const timeline = await engine.getUserTimeline(guildId, userId);
        const body = timelineGraph(timeline);
        await interaction.reply({ ephemeral: true, embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('Risk Timeline (24h)').setDescription(body)] });
        return;
      }
      if (parts[2] === 'signals') {
        const timeline = await engine.getUserTimeline(guildId, userId);
        const value = timeline.slice(0, 20).map((p) => `• ${p.timestamp.toISOString()} ${p.signalType} => ${p.riskScoreAfter}`).join('\n') || 'No signals.';
        await interaction.reply({ ephemeral: true, embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('Recent Signals').setDescription(value)] });
        return;
      }
    }

    if (interaction.isStringSelectMenu()) {
      const choice = interaction.values[0];
      if (choice === 'overview') {
        const embed = await buildUserEmbed(engine, guildId, userId);
        await interaction.update({ embeds: [embed], components: userActionRows(guildId, userId) });
        return;
      }
      if (choice === 'timeline') {
        const timeline = await engine.getUserTimeline(guildId, userId);
        await interaction.reply({ ephemeral: true, embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('Risk Timeline').setDescription(timelineGraph(timeline))] });
        return;
      }
      if (choice === 'signals') {
        const timeline = await engine.getUserTimeline(guildId, userId);
        const value = timeline.slice(0, 20).map((p) => `• ${p.signalType} (${p.riskScoreAfter})`).join('\n') || 'No signals.';
        await interaction.reply({ ephemeral: true, embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('Recent Signals').setDescription(value)] });
      }
      return;
    }
  }

  if (parts[1] === 'top' && interaction.isButton()) {
    const guildId = parts[3];
    const page = Number(parts[4]);
    const nextPage = parts[2] === 'next' ? page + 1 : Math.max(0, page - 1);
    const users = await engine.getTopRiskUsers(guildId, (nextPage + 1) * PAGE_SIZE);
    const slice = users.slice(nextPage * PAGE_SIZE, nextPage * PAGE_SIZE + PAGE_SIZE);
    const description = slice.map((u, i) => `#${nextPage * PAGE_SIZE + i + 1} ${userMention(u.userId)} • Risk ${u.riskScore} • Alt ${u.altScore} ${trendArrow(u.riskTrend)}`).join('\n') || 'No users.';

    await interaction.update({
      embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('Top Risk Users').setDescription(description)],
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`risk:top:prev:${guildId}:${nextPage}`).setLabel('Previous').setStyle(ButtonStyle.Secondary).setDisabled(nextPage === 0),
        new ButtonBuilder().setCustomId(`risk:top:next:${guildId}:${nextPage}`).setLabel('Next').setStyle(ButtonStyle.Secondary).setDisabled(slice.length < PAGE_SIZE),
      )],
    });
  }
}
