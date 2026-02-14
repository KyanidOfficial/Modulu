const eventLoader = require("./core/loaders/event.loader")
const slashLoaderImport = require("./core/loaders/slash.loader")
const prefixLoader = require("./core/loaders/prefix.loader")
const { handleClientError } = require("./core/observability/errorHandler")

const slashLoader =
  typeof slashLoaderImport === "function"
    ? slashLoaderImport
    : typeof slashLoaderImport?.loadSlashCommands === "function"
      ? slashLoaderImport.loadSlashCommands
      : typeof slashLoaderImport?.default === "function"
        ? slashLoaderImport.default
        : null

const slashLoader =
  typeof slashLoaderImport === "function"
    ? slashLoaderImport
    : typeof slashLoaderImport?.loadSlashCommands === "function"
      ? slashLoaderImport.loadSlashCommands
      : typeof slashLoaderImport?.default === "function"
        ? slashLoaderImport.default
        : null

module.exports = client => {
  try {
    eventLoader(client)
  } catch (error) {
    handleClientError({ error, event: "bootstrap.eventLoader" })
  }

  try {
    if (typeof slashLoader !== "function") {
      throw new TypeError("slashLoader is not a function")
    }
    slashLoader(client)
  } catch (error) {
    handleClientError({ error, event: "bootstrap.slashLoader" })
  }

  try {
    prefixLoader(client)
  } catch (error) {
    handleClientError({ error, event: "bootstrap.prefixLoader" })
  }
}
