const sendChannelAlert = async (channel, payload) => {
  if (!channel?.send) return null
  return channel.send(payload)
}

module.exports = {
  sendChannelAlert
}
