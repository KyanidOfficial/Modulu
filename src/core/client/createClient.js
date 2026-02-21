const { Client, GatewayIntentBits, Partials, Collection } = require("discord.js")

const createClient = () => {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildVoiceStates
    ],
    partials: [Partials.Channel]
  })

  client.commands = new Collection()
  client.prefixCommands = new Collection()

  return client
}

module.exports = {
  createClient
}
