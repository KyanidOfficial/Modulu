const matchPattern = (value, threshold) => Number(value || 0) >= Number(threshold || 0)

module.exports = {
  matchPattern
}
