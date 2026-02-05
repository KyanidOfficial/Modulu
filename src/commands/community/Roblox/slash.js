const COMMAND_ENABLED = true
const { SlashCommandBuilder, PermissionsBitField } = require("discord.js")
const db = require("../../../core/database")
const systemEmbed = require("../../../messages/embeds/system.embed")
const errorEmbed = require("../../../messages/embeds/error.embed")
const COLORS = require("../../../utils/colors")
const { getUserIdByUsername, getGroupRank } = require("../../../utils/roblox")

const ensureConfig = async guildId => {
  const data = await db.get(guildId)
  data.setup = data.setup || {}
  data.setup.roblox = data.setup.roblox || { groupId: null, mappings: [] }
  await db.save(guildId, data)
  return { config: data.setup.roblox, data }
}

module.exports = {
  COMMAND_ENABLED,
  data: new SlashCommandBuilder()
    .setName("roblox")
    .setDescription("Roblox group ranking integration")
    .addSubcommand(sub =>
      sub.setName("group-set")
        .setDescription("Set the Roblox group ID")
        .addStringOption(o =>
          o.setName("group_id").setDescription("Roblox group ID").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName("map-role")
        .setDescription("Map a Roblox rank to a Discord role")
        .addIntegerOption(o =>
          o.setName("min_rank").setDescription("Minimum Roblox rank").setRequired(true)
        )
        .addRoleOption(o =>
          o.setName("role").setDescription("Discord role").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName("map-list")
        .setDescription("List Roblox rank mappings")
    )
    .addSubcommand(sub =>
      sub.setName("sync")
        .setDescription("Sync a user's Roblox rank to Discord role")
        .addUserOption(o =>
          o.setName("user").setDescription("Discord user").setRequired(true)
        )
        .addStringOption(o =>
          o.setName("username").setDescription("Roblox username").setRequired(true)
        )
    ),

  async execute(interaction) {
    const guild = interaction.guild
    if (!guild) return

    const sub = interaction.options.getSubcommand()

    if (sub === "sync") {
      const { config } = await ensureConfig(guild.id)
      if (!config.groupId) {
        return interaction.editReply({
          embeds: [systemEmbed({
            title: "Roblox group not set",
            description: "Set a group ID with `/roblox group-set`.",
            color: COLORS.warning
          })]
        })
      }

      const member = interaction.options.getMember("user")
      const username = interaction.options.getString("username")

      if (!member) {
        return interaction.editReply({
          embeds: [errorEmbed({
            users: "Unknown",
            punishment: "roblox sync",
            state: "failed",
            reason: "Member not found",
            color: COLORS.error
          })]
        })
      }

      let userId
      let rankData

      try {
        userId = await getUserIdByUsername(username)
        if (!userId) {
          return interaction.editReply({
            embeds: [systemEmbed({
              title: "Roblox user not found",
              description: `No Roblox user found for **${username}**.`,
              color: COLORS.warning
            })]
          })
        }

        rankData = await getGroupRank(userId, config.groupId)
      } catch (err) {
        return interaction.editReply({
          embeds: [systemEmbed({
            title: "Roblox API error",
            description: "Failed to fetch Roblox rank data.",
            color: COLORS.error
          })]
        })
      }

      if (!rankData) {
        return interaction.editReply({
          embeds: [systemEmbed({
            title: "Not in group",
            description: `${username} is not in the configured group.`,
            color: COLORS.warning
          })]
        })
      }

      const mappings = (config.mappings || []).sort((a, b) => b.minRank - a.minRank)
      const match = mappings.find(m => rankData.rank >= m.minRank)

      if (!match) {
        return interaction.editReply({
          embeds: [systemEmbed({
            title: "No matching role mapping",
            description: `Rank **${rankData.rank}** has no configured role mapping.`,
            color: COLORS.warning
          })]
        })
      }

      if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
        return interaction.editReply({
          embeds: [errorEmbed({
            users: `<@${interaction.user.id}>`,
            punishment: "roblox sync",
            state: "failed",
            reason: "Missing permissions",
            color: COLORS.error
          })]
        })
      }

      if (!guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
        return interaction.editReply({
          embeds: [errorEmbed({
            users: `<@${interaction.user.id}>`,
            punishment: "roblox sync",
            state: "failed",
            reason: "Bot lacks permissions",
            color: COLORS.error
          })]
        })
      }

      const role = guild.roles.cache.get(match.roleId)
      if (!role) {
        return interaction.editReply({
          embeds: [systemEmbed({
            title: "Role missing",
            description: "The mapped role no longer exists.",
            color: COLORS.warning
          })]
        })
      }

      try {
        await member.roles.add(role, "Roblox rank sync")
      } catch {
        return interaction.editReply({
          embeds: [systemEmbed({
            title: "Role update failed",
            description: "Unable to assign the mapped role.",
            color: COLORS.error
          })]
        })
      }

      return interaction.editReply({
        embeds: [systemEmbed({
          title: "Roblox sync complete",
          description: `Assigned <@&${role.id}> to <@${member.id}> (Rank ${rankData.rank}: ${rankData.role}).`,
          color: COLORS.success
        })]
      })
    }

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.editReply({
        embeds: [errorEmbed({
          users: `<@${interaction.user.id}>`,
          punishment: "roblox",
          state: "failed",
          reason: "Administrator permission required",
          color: COLORS.error
        })]
      })
    }

    const { config, data } = await ensureConfig(guild.id)

    if (sub === "group-set") {
      const groupId = interaction.options.getString("group_id")
      config.groupId = groupId
      data.setup.roblox = config
      await db.save(guild.id, data)

      return interaction.editReply({
        embeds: [systemEmbed({
          title: "Roblox group set",
          description: `Group ID set to **${groupId}**.`,
          color: COLORS.success
        })]
      })
    }

    if (sub === "map-role") {
      const minRank = interaction.options.getInteger("min_rank")
      const role = interaction.options.getRole("role")

      config.mappings = config.mappings || []
      const existing = config.mappings.find(m => m.minRank === minRank)
      if (existing) {
        existing.roleId = role.id
      } else {
        config.mappings.push({ minRank, roleId: role.id })
      }

      data.setup.roblox = config
      await db.save(guild.id, data)

      return interaction.editReply({
        embeds: [systemEmbed({
          title: "Mapping saved",
          description: `Mapped rank **${minRank}** to <@&${role.id}>.`,
          color: COLORS.success
        })]
      })
    }

    if (sub === "map-list") {
      const mappings = (config.mappings || []).sort((a, b) => b.minRank - a.minRank)
      if (!mappings.length) {
        return interaction.editReply({
          embeds: [systemEmbed({
            title: "No mappings",
            description: "Use `/roblox map-role` to create one.",
            color: COLORS.warning
          })]
        })
      }

      const description = mappings
        .map(m => `• Rank **${m.minRank}** → <@&${m.roleId}>`)
        .join("\n")

      return interaction.editReply({
        embeds: [systemEmbed({
          title: "Roblox rank mappings",
          description,
          color: COLORS.info
        })]
      })
    }
  }
}
