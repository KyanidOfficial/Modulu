const { Collection } = require("discord.js")

const commands = new Collection()

module.exports = {
  set: (name, cmd) => commands.set(name, cmd),
  get: name => commands.get(name),
  all: () => [...commands.values()],
  size: () => commands.size,

  toTopGG: () =>
    [...commands.values()]
      .filter(cmd => cmd?.data && typeof cmd.data.toJSON === "function")
      .map(cmd => cmd.data.toJSON())
}