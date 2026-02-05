'use strict'

const store = new Map()

const getDefault = () => ({
  setup: {
    completed: false,
    roles: { moderators: [], administrators: [] }
  }
})

const get = async guildId => {
  if (!guildId) throw new Error('Missing guildId')
  if (!store.has(guildId)) {
    store.set(guildId, getDefault())
  }
  return store.get(guildId)
}

const save = async (guildId, data) => {
  if (!guildId) throw new Error('Missing guildId')
  store.set(guildId, data)
}

module.exports = { get, save }
