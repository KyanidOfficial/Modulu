const eventLoader = require("./core/loaders/event.loader")
const slashLoaderImport = require("./core/loaders/slash.loader")
const prefixLoader = require("./core/loaders/prefix.loader")

const slashLoader =
  typeof slashLoaderImport === "function"
    ? slashLoaderImport
    : typeof slashLoaderImport?.loadSlashCommands === "function"
      ? slashLoaderImport.loadSlashCommands
      : typeof slashLoaderImport?.default === "function"
        ? slashLoaderImport.default
        : null

module.exports = client => {
  eventLoader(client)

  if (typeof slashLoader !== "function") {
    throw new TypeError("slashLoader is not a function")
  }

  slashLoader(client)
  prefixLoader(client)
}
