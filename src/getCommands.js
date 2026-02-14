const client = { commands: new Map() }
require("./core/loaders/slash.loader")(client)

console.log(JSON.stringify(Array.from(client.commands.values()).map(c => c.data.toJSON()), null, 2))
