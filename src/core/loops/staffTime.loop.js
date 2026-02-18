const staffDb = require("../database/staffTime")
const dmUser = require("../../utils/dmUser")

const activityEmbed = require("../../messages/embeds/staffTime.activityCheck.embed")
const autoEmbed = require("../../messages/embeds/staffTime.autoClockout.embed")

const CHECK_AFTER = 10 * 1000
const AUTO_AFTER = 10 * 1000
const LOOP_DELAY = 5 * 1000

module.exports = client => {
  console.log("[STAFF TIME] loop started")

  const runIteration = async () => {
    try {
      const now = Date.now()
      const sessions = await staffDb.getAllActive()

      for (const s of sessions) {
        const startedAt = Number(s.started_at)
        const lastCheck = Number(s.last_check || 0)
        const warned = Number(s.warned) === 1

        let user = null
        try {
          user = await client.users.fetch(s.user_id)
        } catch {
          user = null
        }

        if (!user) continue

        const base = lastCheck || startedAt

        if (!warned && now - base >= CHECK_AFTER) {
          await dmUser(user, activityEmbed())
          await staffDb.markWarned(s.guild_id, s.user_id, now)
          continue
        }

        if (warned && now - lastCheck >= AUTO_AFTER) {
          await staffDb.forceEnd({
            guildId: s.guild_id,
            userId: s.user_id,
            reason: "inactivity"
          })

          await dmUser(user, autoEmbed())
          console.log("[STAFF TIME] auto clock-out", s.user_id)
        }
      }
    } catch (error) {
      console.error("[STAFF TIME] loop iteration failed", error)
    } finally {
      setTimeout(() => {
        runIteration().catch(err => {
          console.error("[STAFF TIME] unhandled iteration rejection", err)
        })
      }, LOOP_DELAY)
    }
  }

  runIteration().catch(error => {
    console.error("[STAFF TIME] failed to start loop", error)
  })
}
