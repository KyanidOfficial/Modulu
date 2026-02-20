const https = require("https")

https.get("https://discord.com/api/v10/gateway", res => {
  console.log("Status:", res.statusCode)
  res.on("data", () => {})
  res.on("end", () => console.log("Finished"))
}).on("error", err => {
  console.error("Error:", err)
})