const infoEmbed = require("../../messages/embeds/info.embed")

module.exports = async (user, reasons) => {
  try {
    await user.send({
      embeds: [
        infoEmbed({
          title: "Join Gate Notice",
          description:
            "You were moved to a private review channel.\n\n" +
            "Reasons:\n- " + reasons.join("\n- ")
        })
      ]
    })

    console.log("[JOIN GATE] DM sent")
  } catch {
    console.log("[JOIN GATE] DM failed")
  }
}