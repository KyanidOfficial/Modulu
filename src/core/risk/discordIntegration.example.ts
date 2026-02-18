import { Client, Message, GuildMember } from 'discord.js';
import { RiskEngine } from './RiskEngine';

function accountAgeDays(createdTimestamp: number): number {
  const diff = Date.now() - createdTimestamp;
  return Math.max(0, Math.floor(diff / 86400000));
}

function daysInGuild(joinedTimestamp: number | null): number {
  if (joinedTimestamp === null) {
    return 0;
  }
  return Math.max(0, Math.floor((Date.now() - joinedTimestamp) / 86400000));
}

export function wireRiskEngine(client: Client, riskEngine: RiskEngine): void {
  client.on('messageCreate', async (message: Message) => {
    if (!message.guild || message.author.bot) return;

    const joinedAt = message.member?.joinedTimestamp ?? null;
    await riskEngine.recordMessageEvent({
      guildId: message.guild.id,
      userId: message.author.id,
      content: message.content,
      mentionCount: message.mentions.users.size,
      containsLink: /https?:\/\//i.test(message.content),
      createdAt: new Date(message.createdTimestamp),
    });

    if (/discord\.gg\//i.test(message.content)) {
      await riskEngine.recordSignal({
        guildId: message.guild.id,
        userId: message.author.id,
        signalType: 'invite_spam',
        accountAgeDays: accountAgeDays(message.author.createdTimestamp),
        daysInGuild: daysInGuild(joinedAt),
        occurredAt: new Date(message.createdTimestamp),
      });
    }
  });

  client.on('guildMemberAdd', async (member: GuildMember) => {
    await riskEngine.recordSignal({
      guildId: member.guild.id,
      userId: member.id,
      signalType: 'alt_similarity_low',
      accountAgeDays: accountAgeDays(member.user.createdTimestamp),
      daysInGuild: 0,
      occurredAt: new Date(),
    });
  });
}
