const applyDecay = (value, decay = 0) => Math.max(0, Number(value || 0) - Number(decay || 0))

module.exports = {
  applyDecay
}
