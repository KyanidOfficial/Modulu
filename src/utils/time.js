module.exports = input => {
  const m = input.match(/^(\d+)(s|m|h|d)$/)
  if (!m) return null

  const mult = { s: 1e3, m: 6e4, h: 36e5, d: 864e5 }
  return { ms: +m[1] * mult[m[2]], label: input }
}