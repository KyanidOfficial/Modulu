class MemoryStore {
  constructor() {
    this.map = new Map()
  }

  get(key) {
    return this.map.get(key)
  }

  set(key, value) {
    this.map.set(key, value)
    return value
  }

  delete(key) {
    return this.map.delete(key)
  }

  clear() {
    this.map.clear()
  }
}

module.exports = {
  MemoryStore
}
