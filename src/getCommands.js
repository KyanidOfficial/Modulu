const slashLoader = require("./core/loaders/slash.loader")
const registry = require("./core/registry/slash.commands")

// fake minimal client object
const client = {
  commands: new Map()
}

// load slash commands into registry
slashLoader(client)

// dump for top.gg
console.log(
  JSON.stringify(registry.toTopGG(), null, 2)
)