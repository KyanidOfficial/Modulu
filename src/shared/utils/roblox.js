const getJson = async url => {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Roblox API error: ${res.status}`)
  return res.json()
}

const getUserIdByUsername = async username => {
  const data = await getJson(
    `https://api.roblox.com/users/get-by-username?username=${encodeURIComponent(username)}`
  )
  if (!data?.Id) return null
  return data.Id
}

const getGroupRank = async (userId, groupId) => {
  const data = await getJson(
    `https://groups.roblox.com/v2/users/${userId}/groups/roles`
  )
  const group = data?.data?.find(entry => entry.group?.id === Number(groupId))
  if (!group) return null
  return {
    rank: group.role?.rank ?? 0,
    role: group.role?.name ?? "Unknown"
  }
}

module.exports = { getUserIdByUsername, getGroupRank }
