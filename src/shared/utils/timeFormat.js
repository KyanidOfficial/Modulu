module.exports = seconds => {
  let s = seconds
  const d = Math.floor(s / 86400)
  s %= 86400
  const h = Math.floor(s / 3600)
  s %= 3600
  const m = Math.floor(s / 60)
  s %= 60

  return [
    d ? `${d}d` : null,
    h ? `${h}h` : null,
    m ? `${m}m` : null,
    s ? `${s}s` : null
  ].filter(Boolean).join(" ")
}