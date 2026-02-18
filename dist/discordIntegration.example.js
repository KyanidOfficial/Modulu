"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wireRiskEngine = wireRiskEngine;
function accountAgeDays(createdTimestamp) {
    const diff = Date.now() - createdTimestamp;
    return Math.max(0, Math.floor(diff / 86400000));
}
function daysInGuild(joinedTimestamp) {
    if (joinedTimestamp === null) {
        return 0;
    }
    return Math.max(0, Math.floor((Date.now() - joinedTimestamp) / 86400000));
}
function wireRiskEngine(client, riskEngine) {
    client.on('messageCreate', async (message) => {
        if (!message.guild || message.author.bot)
            return;
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
    client.on('guildMemberAdd', async (member) => {
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
