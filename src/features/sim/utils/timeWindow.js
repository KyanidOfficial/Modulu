const isWithinTimeWindow = ({ now, startedAt, windowMs }) => {
  return Number(now || Date.now()) - Number(startedAt || 0) <= Number(windowMs || 0)
}

module.exports = {
  isWithinTimeWindow
}
