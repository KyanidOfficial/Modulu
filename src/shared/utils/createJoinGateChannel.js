module.exports = async (guild, member, setup) => {
  try {
    const existing = guild.channels.cache.filter(
      c => c.name.startsWith(
        member.user.username
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")
          .slice(0, 8)
      )
    )

    const count = existing.size + 1

    const safeName =
      member.user.username
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 16)

    const name = `${safeName}_${count}`

    const overwrites = [
      {
        id: guild.id,
        deny: ["ViewChannel"]
      },
      {
        id: member.id,
        allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"]
      }
    ]

    for (const id of setup?.roles?.moderators || []) {
      overwrites.push({
        id,
        allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"]
      })
    }

    for (const id of setup?.roles?.administrators || []) {
      overwrites.push({
        id,
        allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"]
      })
    }

    const channel = await guild.channels.create({
      name,
      type: 0,
      permissionOverwrites: overwrites
    })

    console.log("[JOIN GATE] channel created", channel.id)
    return channel
  } catch (err) {
    console.error("[JOIN GATE] channel error", err)
    return null
  }
}