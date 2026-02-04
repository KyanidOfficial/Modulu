const logServerEvent = require("../../utils/logServerEvent")
const serverLogEmbed = require("../../messages/embeds/serverLog.embed")

const pretty = p => p.replace(/([A-Z])/g, " $1").trim()

const diff = (a, b) => {
  const add = []
  const rem = []
  for (const [k, v] of Object.entries(b.serialize()))
    if (v && !a.serialize()[k]) add.push(pretty(k))
  for (const [k, v] of Object.entries(a.serialize()))
    if (v && !b.serialize()[k]) rem.push(pretty(k))
  return { add, rem }
}

module.exports = (client, oldCh, newCh) => {
  if (!newCh.guild) return

  /* RENAME */
  if (oldCh.name !== newCh.name) {
    logServerEvent(
      newCh.guild,
      serverLogEmbed({
        event: "Channel renamed",
        target: `<#${newCh.id}>`,
        details: `${oldCh.name} → ${newCh.name}`
      })
    )
  }

  /* PERMISSION OVERWRITES */
  for (const [id, now] of newCh.permissionOverwrites.cache) {
    const prev = oldCh.permissionOverwrites.cache.get(id)

    if (!prev) {
      logServerEvent(
        newCh.guild,
        serverLogEmbed({
          event: "Permission overwrite added",
          target: now.type === 0 ? `<@&${id}>` : `<@${id}>`,
          details:
            `**Channel:** <#${newCh.id}>\n\n` +
            `**Allowed:**\n${now.allow.toArray().map(p => `- ${pretty(p)}`).join("\n") || "None"}\n\n` +
            `**Denied:**\n${now.deny.toArray().map(p => `- ${pretty(p)}`).join("\n") || "None"}`
        })
      )
      continue
    }

    const a = diff(prev.allow, now.allow)
    const d = diff(prev.deny, now.deny)

    if (a.add.length || a.rem.length || d.add.length || d.rem.length) {
      logServerEvent(
        newCh.guild,
        serverLogEmbed({
          event: "Permission overwrite updated",
          target: now.type === 0 ? `<@&${id}>` : `<@${id}>`,
          details:
            `Channel: <#${newCh.id}>\n\n` +
            (a.add.length ? `**Allowed added:**\n${a.add.map(x => `- ${x}`).join("\n")}\n` : "") +
            (a.rem.length ? `**Allowed removed:**\n${a.rem.map(x => `- ${x}`).join("\n")}\n` : "") +
            (d.add.length ? `**Denied added:**\n${d.add.map(x => `- ${x}`).join("\n")}\n` : "") +
            (d.rem.length ? `**Denied removed:**\n${d.rem.map(x => `- ${x}`).join("\n")}` : "")
        })
      )
    }
  }

  for (const [id, oldOv] of oldCh.permissionOverwrites.cache) {
    if (!newCh.permissionOverwrites.cache.has(id)) {
      logServerEvent(
        newCh.guild,
        serverLogEmbed({
          event: "Permission overwrite removed",
          target: oldOv.type === 0 ? `<@&${id}>` : `<@${id}>`,
          details: `**Channel:** <#${newCh.id}>`
        })
      )
    }
  }
}