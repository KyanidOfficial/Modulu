const { EmbedBuilder } = require("discord.js")

const chunk = (arr, size) => {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

module.exports = {
  caseEmbed(row) {
    const context = row.context_json ? JSON.parse(row.context_json) : { messages: [] }
    return new EmbedBuilder()
      .setTitle(`Case #${row.case_id}`)
      .addFields(
        { name: "User", value: `<@${row.user_id}>`, inline: true },
        { name: "Action", value: row.action_type, inline: true },
        { name: "Reason", value: row.reason || "N/A" }
      )
      .setDescription(`Context messages: ${context.messages?.length || 0}`)
      .setTimestamp(new Date(row.created_at))
  },

  historyEmbeds(rows, pageSize = 5) {
    const pages = chunk(rows, pageSize)
    return pages.map((group, index) => {
      const lines = group.map(r => `#${r.case_id} • ${r.action_type} • <t:${Math.floor(new Date(r.created_at).getTime() / 1000)}:R>`)
      return new EmbedBuilder()
        .setTitle(`Case History (Page ${index + 1}/${pages.length || 1})`)
        .setDescription(lines.join("\n") || "No cases found")
    })
  }
}
