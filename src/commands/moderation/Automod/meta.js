module.exports = {
  category: "Moderation",
  description: "Manage austo-moderation settings",
  usage: "automod <toggle|add-pattern|remove-pattern|set-blocked-domains|show>",
  example: "automod set-blocked-domains domains:bit.ly,tinyurl.com,bad-domain.com",
  permissions: ["ManageServer"]
}