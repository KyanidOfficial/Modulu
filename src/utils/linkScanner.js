module.exports.extract = content => {
  if (!content) return []

  const regex = /((https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/[^\s]*)?)/gi
  return content.match(regex) || []
}